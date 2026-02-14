'use client'

import { useEffect, useRef } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}

export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="backdrop:bg-black/50 bg-card rounded-xl shadow-xl p-0 w-[calc(100%-2rem)] max-w-sm"
    >
      <div className="p-5">
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <div className="text-sm text-muted">{children}</div>
      </div>
      {actions && (
        <div className="flex justify-end gap-2 px-5 pb-5">
          {actions}
        </div>
      )}
    </dialog>
  )
}
