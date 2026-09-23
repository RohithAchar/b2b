"use client"

import { createContext, useContext, type ReactNode } from "react"

export type StorefrontCategory = {
  id: string
  name: string
  slug: string
}

const StorefrontDataContext = createContext<StorefrontCategory[]>([])

export function StorefrontDataProvider({
  categories,
  children,
}: {
  categories: StorefrontCategory[]
  children: ReactNode
}) {
  return (
    <StorefrontDataContext.Provider value={categories}>
      {children}
    </StorefrontDataContext.Provider>
  )
}

export function useStorefrontCategories() {
  return useContext(StorefrontDataContext)
}
