"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveCompany,
  rejectCompany,
  type AdminActionState,
} from "@/lib/admin/actions";

const initialState: AdminActionState = { ok: false, message: "" };

export function DecisionForm({ id }: { id: string }) {
  const [approveState, approveAction, approving] = useActionState(
    approveCompany,
    initialState,
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectCompany,
    initialState,
  );
  const [showReject, setShowReject] = useState(false);
  const message = approveState.message || rejectState.message;

  return (
    <div className="flex flex-col gap-4">
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <form action={approveAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" disabled={approving || rejecting} className="w-full">
          {approving ? "Approving…" : "Approve supplier"}
        </Button>
      </form>
      {!showReject ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setShowReject(true)}
        >
          Send back with note
        </Button>
      ) : (
        <form action={rejectAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="note">What should the supplier fix?</Label>
            <Textarea
              id="note"
              name="note"
              placeholder="e.g. GST certificate is blurry — please upload a clearer scan."
              required
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setShowReject(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={rejecting}
              className="flex-1"
            >
              {rejecting ? "Sending…" : "Send back"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
