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
  label: string
  icon: LucideIcon
  end?: boolean
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Library', icon: FileText, end: true },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/folders', label: 'Folders', icon: FolderTree },
  { to: '/ai', label: 'AI', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/logs', label: 'Logs', icon: ScrollText },
]
