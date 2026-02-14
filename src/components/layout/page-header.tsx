interface PageHeaderProps {
  title: string
  action?: React.ReactNode
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  )
}
