"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useActionState,
  type FormEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { FieldError } from "@/components/ui/field"
import {
  createProduct,
  updateProduct,
  checkSkuDuplicate,
  type ProductActionState,
} from "@/lib/supplier/product-actions"
import {
  MAX_PRODUCT_IMAGES,
  MIN_PRODUCT_IMAGES,
  existingImageKey,
  extractYoutubeId,
  stagedImageIndex,
  stagedImageKey,
} from "@/lib/supplier/products"
import { fieldIdForMessage } from "@/lib/supplier/form-errors"
import {
  DESCRIPTION_MIN_TEXT_CHARS,
  defaultSeoDescription,
  defaultSeoTitle,
  plainTextLength,
} from "@/lib/supplier/rich-text"
import { ProductInformationSection } from "./product-information-section"
import { ProductMediaSection } from "./product-media-section"
import { PricingSection } from "./pricing-section"
import { ShippingTaxSection } from "./shipping-tax-section"
import { VariantsSection } from "./variants-section"
import {
  attributesFromVariants,
  buildVariantRows,
  type VariantAttribute,
} from "./variant-builder"
import { ProductSeoSection } from "./product-seo-section"
import { findLowResImages, lowResWarning, shrinkImageFile } from "@/lib/shrink-image"
import { ProductReadiness } from "./product-readiness"
import {
  ProductFormActions,
  ProductFormStickyActions,
} from "./product-form-actions"
import {
  ProductFormSectionNav,
  ProductFormSectionTabs,
} from "./product-form-navigation"
import type {
  CategoryOption,
  ExistingProduct,
  ExistingVariant,
} from "./product-form-types"

const initialState: ProductActionState = { ok: false, message: "" }

function productImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${path}`
}

function loadDraft(key: string): Map<string, string> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null
    const m = new Map<string, string>()
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") m.set(k, v)
    }
    return m
  } catch {
    return null
  }
}

export function ProductForm({
  mode,
  product,
  categories,
  title,
  description,
  storeId,
}: {
  mode: "create" | "edit"
  product?: ExistingProduct
  categories: CategoryOption[]
  title: string
  description: string
  storeId?: string
}) {
  const boundAction =
    mode === "create"
      ? createProduct
      : updateProduct.bind(null, product?.id ?? "")
  const showSubmit = product?.status !== "approved"
  const saveLabel =
    product?.status === "approved" ? "Save changes" : "Save draft"
  // Live view only on the edit page of a published product.
  const liveHref =
    mode === "edit" && product?.status === "approved"
      ? `/products/${product.id}`
      : undefined
  const [state, action, pending] = useActionState(boundAction, initialState)
  const [invalidField, setInvalidField] = useState<{
    id: string
    message: string
  } | null>(null)
  // Render-phase adjustment: when a server action returns an error, attach it
  // to the offending input by resolving the message to a field id. The
  // previous-action-state pattern is the React-sanctioned way to react to a
  // state change without an effect watching form state.
  const [prevActionState, setPrevActionState] = useState(state)
  if (state !== prevActionState) {
    setPrevActionState(state)
    if (state.ok) {
      setInvalidField(null)
    } else if (state.message) {
      const fieldId = fieldIdForMessage(state.message)
      if (fieldId) setInvalidField({ id: fieldId, message: state.message })
    }
  }
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<"draft" | "submit" | null>(
    null
  )
  const formRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const seoImageInputRef = useRef<HTMLInputElement>(null)
  // Submission gate: the browser never POSTs unless our own code sets this
  // flag after explicit validation. Any stray submit (wrong button type,
  // Enter key, extension) is intercepted below and routed to validation.
  const allowSubmitRef = useRef(false)
  // When set, the next allowed POST additionally requests submission for
  // approval right after saving.
  const autoSubmitRef = useRef(false)

  const [negotiable, setNegotiable] = useState(product?.negotiable ?? false)
  const [isWinning, setIsWinning] = useState(product?.is_winning ?? false)
  const [isHotSelling, setIsHotSelling] = useState(
    product?.is_hot_selling ?? false
  )
  const [attributes, setAttributes] = useState<VariantAttribute[]>(() =>
    attributesFromVariants(product?.variants)
  )
  const [variants, setVariants] = useState<ExistingVariant[]>(
    product?.variants ?? []
  )
  const hasVariants = variants.length > 0
  const [newFiles, setNewFiles] = useState<File[]>([])
  // Latest staged files for the async (shrink-then-stage) handlers, so two
  // quick picks don't overwrite each other with a stale list.
  const newFilesRef = useRef<File[]>([])
  const [removedImagePaths, setRemovedImagePaths] = useState<string[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  // Display order of the gallery (drag to reorder); the first image is the cover.
  const [imageOrder, setImageOrder] = useState<string[]>(() =>
    (product?.images ?? []).map((image) => existingImageKey(image.path))
  )
  const [youtubeUrl, setYoutubeUrl] = useState(product?.youtube_url ?? "")
  const objectUrlsRef = useRef<string[]>([])

  const [seoFile, setSeoFile] = useState<File | null>(null)
  const [seoPreview, setSeoPreview] = useState<string | null>(null)
  const [seoImageCleared, setSeoImageCleared] = useState(false)

  // Real-time SKU duplicate check.
  const [skuDuplicate, setSkuDuplicate] = useState<boolean | null>(null)
  const seoObjectUrlRef = useRef<string | null>(null)

  // Draft persistence: text fields survive a full reload. Files, cropped
  // images and variant rows are browser-side objects and cannot be restored,
  // so they are intentionally excluded.
  const draftKey = `b2b:pf:${mode}:${product?.id ?? "new"}`

  const initialFormValues = useMemo(() => {
    const m = new Map<string, string>()
    if (product) {
      const set = (key: string, value: string | number | null | undefined) => {
        if (value === null || value === undefined) return
        m.set(key, String(value))
      }
      set("title", product.title)
      set("category_id", product.category_id)
      set("seller_sku", product.seller_sku)
      set("hsn_code", product.hsn_code)
      set("gst_rate", product.gst_rate)
      set("carton_units", product.carton_units)
      set("carton_dimensions", product.carton_dimensions)
      set("carton_weight_kg", product.carton_weight_kg)
      set("description", product.description)
      set("unit", product.unit)
      set("price_per_unit", product.price_per_unit)
      set("mrp", product.mrp)
      set("packaging_details", product.packaging_details)
      set("warranty_return", product.warranty_return)
      set("youtube_url", product.youtube_url)
      set("seo_title", product.seo_title)
      set("seo_description", product.seo_description)
    }
    return m
  }, [product])

  const [formValues, setFormValues] =
    useState<Map<string, string>>(initialFormValues)

  const [seoTitleTouched, setSeoTitleTouched] = useState(false)
  const [seoDescriptionTouched, setSeoDescriptionTouched] = useState(false)

  const youtubeId = useMemo(() => extractYoutubeId(youtubeUrl), [youtubeUrl])
  const existingImages = useMemo(() => product?.images ?? [], [product])
  const visibleExistingImages = useMemo(
    () =>
      existingImages.filter((image) => !removedImagePaths.includes(image.path)),
    [existingImages, removedImagePaths]
  )
  const imageKeys = useMemo(
    () => [
      ...visibleExistingImages.map((image) => existingImageKey(image.path)),
      ...newFiles.map((_, index) => stagedImageKey(index)),
    ],
    [visibleExistingImages, newFiles]
  )
  // Keys in display order: the supplier's arrangement first, then anything new.
  const orderedImageKeys = useMemo(
    () => [
      ...imageOrder.filter((key) => imageKeys.includes(key)),
      ...imageKeys.filter((key) => !imageOrder.includes(key)),
    ],
    [imageOrder, imageKeys]
  )
  const effectivePrimaryImageKey = orderedImageKeys[0] ?? null
  const totalImages =
    existingImages.length -
    removedImagePaths.length +
    Math.max(newFiles.length, fileInputRef.current?.files?.length || 0)
  const canAddMore = totalImages < MAX_PRODUCT_IMAGES

  const variantsJson = useMemo(() => {
    if (!hasVariants) return ""
    return JSON.stringify(
      variants
        .filter((v) => v.label.trim() !== "")
        .map((v) => ({
          id: v.id ?? undefined,
          label: v.label,
          attr_key: v.attr_key ?? "",
          attr_value: v.attr_value ?? "",
          attrs: v.attrs,
          seller_sku: v.seller_sku,
          price: v.price,
          moq: v.moq,
          stock_qty: v.stock_qty,
        }))
    )
  }, [hasVariants, variants])

  const listedVariants = useMemo(
    () => (hasVariants ? variants.filter((v) => v.label.trim() !== "") : []),
    [hasVariants, variants]
  )

  function setFormValue(key: string, value: string) {
    setFormValues((prev) => {
      if (Object.is(prev.get(key), value)) return prev
      const next = new Map(prev)
      next.set(key, value)
      return next
    })
    if (invalidField?.id === key) setInvalidField(null)
  }

  // Restore any saved draft after mount so the server-rendered markup and the
  // first client render match. Loading in the useState initializer caused a
  // hydration mismatch whenever a draft existed. Deferred so the restore does
  // not cascade a synchronous render inside the effect.
  useEffect(() => {
    const draft = loadDraft(draftKey)
    if (!draft) return
    const timer = window.setTimeout(() => setFormValues(draft), 0)
    return () => window.clearTimeout(timer)
  }, [draftKey])

  // Persist text fields to sessionStorage (debounced). Stops for good once the
  // product is saved, so a late timer can't write it back as the next draft.
  const draftSaveTimerRef = useRef<number | null>(null)
  const savedRef = useRef(false)
  useEffect(() => {
    if (savedRef.current) return
    if (draftSaveTimerRef.current)
      window.clearTimeout(draftSaveTimerRef.current)
    draftSaveTimerRef.current = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(
          draftKey,
          JSON.stringify(Object.fromEntries(formValues))
        )
      } catch {
        // storage unavailable — ignore
      }
    }, 500)
    return () => {
      if (draftSaveTimerRef.current)
        window.clearTimeout(draftSaveTimerRef.current)
    }
  }, [formValues, draftKey])

  // Clear the draft once a save succeeds.
  useEffect(() => {
    if (state.ok) {
      try {
        window.sessionStorage.removeItem(draftKey)
      } catch {
        // ignore
      }
    }
  }, [state.ok, draftKey])

  // Real-time SKU duplicate check (debounced).
  useEffect(() => {
    const sku = formValues.get("seller_sku")?.trim() ?? ""
    const timer = window.setTimeout(async () => {
      if (!sku) {
        setSkuDuplicate(null)
        return
      }
      try {
        const res = await checkSkuDuplicate(sku, product?.id)
        setSkuDuplicate(res.duplicate)
      } catch {
        setSkuDuplicate(null)
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [formValues, product?.id])

  // After a save: a new product goes to the products list; an edit stays on
  // this page and refreshes, so the supplier can keep editing (the edit page
  // remounts this form from the saved data, see its `key`).
  // A new product that came back with an id exists even when ok is false
  // ("Saved, but could not submit for approval"): leave the form too, or the
  // next "Add product" restores it and a second save duplicates it.
  useEffect(() => {
    const created = mode === "create" && Boolean(state.productId)
    if ((state.ok && state.productId) || created) {
      savedRef.current = true
      // Cancel any pending draft save so it doesn't re-save after clear.
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = null
      }
      // Clear the draft synchronously before navigating away.
      try {
        window.sessionStorage.removeItem(draftKey)
      } catch {
        // ignore
      }
      if (mode === "edit") {
        toast.add({
          type: "success",
          title: "Changes saved",
          description: state.message,
        })
        router.refresh()
      } else {
        if (!state.ok) {
          toast.add({ type: "error", title: "Product saved as draft", description: state.message })
        }
        router.push("/supplier/dashboard/products")
      }
    }
  }, [state, mode, router, draftKey])

  // Route every field error to one scroll/focus path so client-side and
  // server-side errors behave identically. Hidden inputs (like #images) have
  // no focusable target, so scroll to their visible field wrapper instead.
  useEffect(() => {
    if (!invalidField) return
    const el = document.getElementById(invalidField.id)
    const wrap = el?.closest('[data-slot="field"]') ?? el
    wrap?.scrollIntoView({ block: "center", behavior: "smooth" })
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      if (!el.disabled && !el.hidden) el.focus({ preventScroll: true })
    }
  }, [invalidField])

  // Auto-fill SEO fields from the title/description until the supplier types
  // into the SEO fields themselves. Computed during render (never via an
  // effect) and handed to the SEO section so its controlled inputs, counters
  // and submitted FormData all reflect the effective value.
  const seoValues = useMemo(() => {
    const next = new Map(formValues)
    if (!seoTitleTouched) {
      const seo = next.get("seo_title") ?? ""
      if (seo === "")
        next.set("seo_title", defaultSeoTitle(next.get("title") ?? ""))
    }
    if (!seoDescriptionTouched) {
      const seo = next.get("seo_description") ?? ""
      if (seo === "")
        next.set(
          "seo_description",
          defaultSeoDescription(next.get("description") ?? "")
        )
    }
    return next
  }, [formValues, seoTitleTouched, seoDescriptionTouched])

  function handleSeoTitleChange(value: string) {
    setFormValue("seo_title", value)
    setSeoTitleTouched(true)
  }

  function handleSeoDescriptionChange(value: string) {
    setFormValue("seo_description", value)
    setSeoDescriptionTouched(true)
  }

  function regenerateSeo() {
    setFormValue("seo_title", defaultSeoTitle(formValues.get("title") ?? ""))
    setFormValue(
      "seo_description",
      defaultSeoDescription(formValues.get("description") ?? "")
    )
    setSeoTitleTouched(false)
    setSeoDescriptionTouched(false)
  }

  function commitFilesToInput(input: HTMLInputElement | null, files: File[]) {
    if (!input) return
    const dt = new DataTransfer()
    for (const f of files) dt.items.add(f)
    input.files = dt.files
  }

  function commitStagedFiles(files: File[]) {
    commitFilesToInput(fileInputRef.current, files)
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url)
    const urls = files.map((f) => URL.createObjectURL(f))
    objectUrlsRef.current = urls
    newFilesRef.current = files
    setPreviewUrls(urls)
    setNewFiles(files)
  }

  /** Advise (never block) when a photo is too small to look sharp. */
  async function warnIfLowRes(files: File[]) {
    const warning = lowResWarning(await findLowResImages(files))
    if (warning) toast.add({ type: "warning", ...warning })
  }

  async function addFiles(picked: File[]) {
    if (picked.length === 0) return
    void warnIfLowRes(picked)
    // Shrink before staging: Vercel rejects a save request over 4.5 MB (413).
    const files = await Promise.all(picked.map(shrinkImageFile))
    const current = newFilesRef.current
    const seen = new Set(
      current.map((f) => `${f.name}:${f.size}:${f.lastModified}`)
    )
    const merged = [
      ...current,
      ...files.filter(
        (f) => !seen.has(`${f.name}:${f.size}:${f.lastModified}`)
      ),
    ].slice(0, MAX_PRODUCT_IMAGES)
    commitStagedFiles(merged)
  }

  function makePrimary(key: string) {
    setImageOrder([key, ...orderedImageKeys.filter((k) => k !== key)])
  }

  function removeStaged(index: number) {
    // Staged keys are index-based: drop the removed one and shift later ones.
    setImageOrder(
      orderedImageKeys.flatMap((key) => {
        const i = stagedImageIndex(key)
        if (i === null || i < index) return [key]
        return i === index ? [] : [stagedImageKey(i - 1)]
      })
    )
    commitStagedFiles(newFiles.filter((_, i) => i !== index))
  }

  async function replaceStaged(index: number, cropped: File) {
    void warnIfLowRes([cropped])
    const file = await shrinkImageFile(cropped)
    commitStagedFiles(newFilesRef.current.map((f, i) => (i === index ? file : f)))
  }

  function removeExisting(path: string) {
    setRemovedImagePaths((prev) =>
      prev.includes(path) ? prev : [...prev, path]
    )
  }

  async function replaceExisting(path: string, cropped: File) {
    void warnIfLowRes([cropped])
    const file = await shrinkImageFile(cropped)
    const nextFiles = [...newFilesRef.current, file].slice(0, MAX_PRODUCT_IMAGES)
    // The cropped copy takes the original's place in the order.
    const replacedKey = existingImageKey(path)
    const newKey = stagedImageKey(nextFiles.length - 1)
    setImageOrder(
      orderedImageKeys.map((key) => (key === replacedKey ? newKey : key))
    )
    setRemovedImagePaths((prev) =>
      prev.includes(path) ? prev : [...prev, path]
    )
    commitStagedFiles(nextFiles)
  }

  async function onSeoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null
    e.target.value = ""
    if (picked) void warnIfLowRes([picked])
    const file = picked ? await shrinkImageFile(picked) : null
    syncSeoInput(file)
    if (seoObjectUrlRef.current) URL.revokeObjectURL(seoObjectUrlRef.current)
    seoObjectUrlRef.current = null
    if (!file) {
      setSeoPreview(null)
      setSeoFile(null)
      return
    }
    const url = URL.createObjectURL(file)
    seoObjectUrlRef.current = url
    setSeoPreview(url)
    setSeoFile(file)
    setSeoImageCleared(false)
  }

  function syncSeoInput(file: File | null) {
    commitFilesToInput(seoImageInputRef.current, file ? [file] : [])
  }

  function removeSeoImage() {
    if (seoObjectUrlRef.current) URL.revokeObjectURL(seoObjectUrlRef.current)
    seoObjectUrlRef.current = null
    syncSeoInput(null)
    setSeoPreview(null)
    setSeoFile(null)
    setSeoImageCleared(true)
  }

  function applySeoCrop(file: File) {
    if (seoObjectUrlRef.current) URL.revokeObjectURL(seoObjectUrlRef.current)
    const url = URL.createObjectURL(file)
    seoObjectUrlRef.current = url
    syncSeoInput(file)
    setSeoFile(file)
    setSeoPreview(url)
    setSeoImageCleared(false)
  }

  function updateVariant(index: number, patch: Partial<ExistingVariant>) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...patch } : v))
    )
  }

  function handleAttributesChange(next: VariantAttribute[]) {
    setAttributes(next)
    setVariants((prev) => buildVariantRows(next, prev))
  }

  function controlKey(
    el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  ): string {
    return el.id || el.getAttribute("aria-label") || el.name
  }

  function pinpoint(
    el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  ) {
    setInvalidField({ id: controlKey(el), message: el.validationMessage })
  }

  function firstInvalidIn(
    root: Element | null
  ): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
    const fields = root?.querySelectorAll("input, textarea, select") ?? []
    for (const field of fields) {
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        if (!field.checkValidity()) return field
      }
    }
    return null
  }

  function invalidFor(id: string): boolean | undefined {
    return invalidField?.id === id ? true : undefined
  }

  function errorFor(id: string): ReactNode {
    return invalidField?.id === id ? (
      <FieldError>{invalidField.message}</FieldError>
    ) : null
  }

  function clearInvalidForEvent(e: SyntheticEvent) {
    if (!invalidField) return
    const t = e.target
    if (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement
    ) {
      if (controlKey(t) === invalidField.id) setInvalidField(null)
    }
  }

  // Rich-text descriptions need a custom length check because the browser
  // cannot count visible text inside HTML.
  function validateDescription(): boolean {
    const text = plainTextLength(formValues.get("description") ?? "")
    if (text >= DESCRIPTION_MIN_TEXT_CHARS) return true
    setInvalidField({
      id: "description",
      message: `Description needs at least ${DESCRIPTION_MIN_TEXT_CHARS} characters of text.`,
    })
    return false
  }

  function onFormSubmit(e: FormEvent<HTMLFormElement>) {
    const form = formRef.current
    // Second pass: our own code explicitly allowed this POST.
    if (allowSubmitRef.current) {
      allowSubmitRef.current = false
      return
    }
    // First pass: intercept EVERY submit — no POST leaves the browser
    // without passing explicit validation below.
    e.preventDefault()
    if (!form) return
    if (skuDuplicate === true) {
      setInvalidField({
        id: "seller_sku",
        message: "This SKU is already used by another product.",
      })
      return
    }
    if (!validateDescription()) return
    if (autoSubmitRef.current && totalImages < MIN_PRODUCT_IMAGES) {
      setInvalidField({
        id: "images",
        message: `Add at least ${MIN_PRODUCT_IMAGES} images before submitting.`,
      })
      return
    }
    const bad = firstInvalidIn(form)
    if (bad) {
      pinpoint(bad)
      return
    }
    // React resets the <form> after every server-action submit, which empties
    // the file inputs while the previews (React state) stay on screen. Re-sync
    // both inputs from state so a retry after any failed save still uploads
    // the images the supplier can see.
    commitFilesToInput(fileInputRef.current, newFiles)
    commitFilesToInput(seoImageInputRef.current, seoFile ? [seoFile] : [])
    if (autoSubmitRef.current) {
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "auto_submit"
      input.value = "1"
      form.appendChild(input)
    }
    // Explicitly allowed: re-submit programmatically so the POST goes
    // through the second pass above. Deferred to avoid re-entrancy issues
    // where requestSubmit() is ignored during an active submit handler.
    allowSubmitRef.current = true
    setTimeout(() => {
      try {
        form.requestSubmit()
      } catch {
        allowSubmitRef.current = false
      }
    }, 0)
  }

  function requestSave(kind: "draft" | "submit") {
    if (pending) return
    autoSubmitRef.current = kind === "submit"
    setPendingAction(kind)
    formRef.current?.requestSubmit()
  }

  const statusAlert = state.message ? (
    <Alert variant={state.ok ? "default" : "destructive"}>
      <AlertTitle>{state.ok ? "Saved" : "Check the form"}</AlertTitle>
      <AlertDescription>
        {state.message}
        {state.ok ? (
          <>
            {" "}
            <Link
              href="/supplier/dashboard/products"
              className="underline underline-offset-4 hover:text-primary"
            >
              View products
            </Link>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  ) : null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div>
        <Link
          href="/supplier/dashboard/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          All products
        </Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <form
        ref={formRef}
        action={action}
        noValidate
        onChangeCapture={clearInvalidForEvent}
        onSubmit={onFormSubmit}
      >
        <input type="hidden" name="wizard_complete" value="1" />
        <input type="hidden" name="variants_json" value={variantsJson} />
        <input
          type="hidden"
          name="seo_image_clear"
          value={seoImageCleared ? "1" : ""}
        />
        <input
          type="hidden"
          name="removed_image_paths"
          value={JSON.stringify(removedImagePaths)}
        />
        <input
          type="hidden"
          name="primary_image"
          value={effectivePrimaryImageKey ?? ""}
        />
        <input
          type="hidden"
          name="image_order"
          value={JSON.stringify(orderedImageKeys)}
        />
        <input type="hidden" name="is_winning" value={isWinning ? "1" : ""} />
        <input
          type="hidden"
          name="is_hot_selling"
          value={isHotSelling ? "1" : ""}
        />
        {storeId ? (
          <input type="hidden" name="store_id" value={storeId} />
        ) : null}

        <ProductFormSectionTabs />

        <div className="grid grid-cols-1 items-start gap-4 @3xl/content:grid-cols-[minmax(0,1fr)_300px] @5xl/content:grid-cols-[176px_minmax(0,1fr)_300px]">
          <nav
            aria-label="Product sections"
            className="hidden @5xl/content:sticky @5xl/content:top-4 @5xl/content:block"
          >
            <ProductFormSectionNav />
          </nav>

          <div className="flex min-w-0 flex-col gap-4">
            <ProductInformationSection
              categories={categories}
              invalidFor={invalidFor}
              errorFor={errorFor}
              formValues={formValues}
              onValueChange={setFormValue}
              skuDuplicate={skuDuplicate}
            />
            <ProductMediaSection
              fileInputRef={fileInputRef}
              onFilesPicked={addFiles}
              existingImages={existingImages}
              newFiles={newFiles}
              previewUrls={previewUrls}
              removedImagePaths={removedImagePaths}
              totalImages={totalImages}
              canAddMore={canAddMore}
              orderedKeys={orderedImageKeys}
              onReorder={setImageOrder}
              onMakePrimary={makePrimary}
              onRemoveStaged={removeStaged}
              onRemoveExisting={removeExisting}
              onReplaceStaged={replaceStaged}
              onReplaceExisting={replaceExisting}
              productImageUrl={productImageUrl}
              youtubeUrl={youtubeUrl}
              onYoutubeChange={setYoutubeUrl}
              youtubeId={youtubeId}
              invalidFor={invalidFor}
              errorFor={errorFor}
            />
            <PricingSection
              negotiable={negotiable}
              onNegotiableChange={setNegotiable}
            />
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <span className="text-sm font-medium">Promotions</span>
              <label className="flex items-center justify-between gap-3 text-sm">
                Winning product
                <Switch checked={isWinning} onCheckedChange={setIsWinning} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                Hot selling product
                <Switch
                  checked={isHotSelling}
                  onCheckedChange={setIsHotSelling}
                />
              </label>
            </div>
            <ShippingTaxSection
              formValues={formValues}
              onValueChange={setFormValue}
            />
            <VariantsSection
              invalidFor={invalidFor}
              invalidField={invalidField}
              attributes={attributes}
              onAttributesChange={handleAttributesChange}
              variants={variants}
              onUpdateVariant={updateVariant}
            />
            <ProductSeoSection
              invalidFor={invalidFor}
              errorFor={errorFor}
              product={product}
              formValues={seoValues}
              seoTitleTouched={seoTitleTouched}
              seoDescriptionTouched={seoDescriptionTouched}
              onSeoTitleChange={handleSeoTitleChange}
              onSeoDescriptionChange={handleSeoDescriptionChange}
              onRegenerateSeo={regenerateSeo}
              seoFile={seoFile}
              seoPreview={seoPreview}
              seoImageCleared={seoImageCleared}
              seoImageInputRef={seoImageInputRef}
              onSeoFileChange={onSeoFileChange}
              onSeoImageRemove={removeSeoImage}
              onSeoCropApplied={applySeoCrop}
              productImageUrl={productImageUrl}
            />
            <div className="@3xl/content:hidden">{statusAlert}</div>
          </div>

          <aside className="hidden flex-col gap-4 @3xl/content:sticky @3xl/content:top-4 @3xl/content:flex">
            <ProductReadiness
              formValues={formValues}
              totalImages={totalImages}
              variantCount={listedVariants.length}
            />
            <ProductFormActions
              pending={pending}
              pendingAction={pendingAction}
              onSaveDraft={() => requestSave("draft")}
              onSaveSubmit={() => requestSave("submit")}
              showSubmit={showSubmit}
              saveLabel={saveLabel}
              liveHref={liveHref}
            />
            <div className="hidden @3xl/content:block">{statusAlert}</div>
          </aside>
        </div>

        <ProductFormStickyActions
          pending={pending}
          pendingAction={pendingAction}
          onSaveDraft={() => requestSave("draft")}
          onSaveSubmit={() => requestSave("submit")}
          showSubmit={showSubmit}
          saveLabel={saveLabel}
          liveHref={liveHref}
        />
      </form>
    </div>
  )
}

// Kept for import compatibility with server pages.
export type { ExistingProduct } from "./product-form-types"
