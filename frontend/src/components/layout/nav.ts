import {
  FileText,
  Tags,
  FolderTree,
  Bot,
  Settings,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  end?: boolean
}

export const NAV: NavItem[] = [
  { to: '/', labelKey: 'menu.library', icon: FileText, end: true },
  { to: '/categories', labelKey: 'menu.categories', icon: Tags },
  { to: '/folders', labelKey: 'menu.folders', icon: FolderTree },
  { to: '/ai', labelKey: 'menu.ai', icon: Bot },
  { to: '/settings', labelKey: 'menu.settings', icon: Settings },
  { to: '/logs', labelKey: 'menu.logs', icon: ScrollText },
]
