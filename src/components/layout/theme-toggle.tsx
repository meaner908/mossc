"use client"

import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-8 text-muted-foreground"
        )}
        aria-label={t("topNav.theme.toggle")}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn(theme === "light" && "font-medium")}
        >
          <Sun className="mr-2 h-4 w-4" />
          {t("topNav.theme.light")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn(theme === "dark" && "font-medium")}
        >
          <Moon className="mr-2 h-4 w-4" />
          {t("topNav.theme.dark")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={cn(theme === "system" && "font-medium")}
        >
          <Monitor className="mr-2 h-4 w-4" />
          {t("topNav.theme.system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
