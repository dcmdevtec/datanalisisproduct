import type { ReactNode } from "react"
import ClientLayout from "@/app/client-layout"

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>
}
