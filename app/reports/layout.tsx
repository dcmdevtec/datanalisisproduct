import type { ReactNode } from "react"
import ClientLayout from "@/app/client-layout"

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>
}
