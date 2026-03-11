"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Trash2, KeyRound, ShieldCheck, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/i18n"

type UserRecord = {
  id: string
  username: string
  role: "admin" | "user"
  createdAt: number
}

type ApiUser = { id: string; username: string; role: "admin" | "user"; createdAt: number }

// ─── Create User Form ─────────────────────────────────────────────────────────

function CreateUserForm({
  onCreated,
}: {
  onCreated: (user: UserRecord) => void
}) {
  const { t } = useI18n()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "user">("user")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      })
      const data = (await res.json()) as { ok?: boolean; user?: ApiUser; error?: string }
      if (!res.ok || !data.user) {
        setError(data.error ?? t("userManagement.createFailed"))
        return
      }
      onCreated(data.user)
      setUsername("")
      setPassword("")
      setRole("user")
    } catch {
      setError(t("login.networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="new-username">{t("login.usernameLabel")}</Label>
          <Input
            id="new-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("login.usernamePlaceholder")}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-password">{t("login.passwordLabel")}</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("setup.passwordPlaceholder")}
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm">{t("userManagement.roleLabel")}</Label>
        <div className="flex gap-2">
          {(["user", "admin"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                role === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {r === "admin" ? (
                <ShieldCheck className="size-3" />
              ) : (
                <User className="size-3" />
              )}
              {r === "admin" ? t("userManagement.roleAdmin") : t("userManagement.roleUser")}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <Button type="submit" size="sm" disabled={loading || !username || !password}>
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          {t("userManagement.createUser")}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

// ─── Change Password Dialog ───────────────────────────────────────────────────

function ChangePasswordInline({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const { t } = useI18n()
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(data.error ?? t("userManagement.changePasswordFailed"))
        return
      }
      setSuccess(true)
      setTimeout(onClose, 1000)
    } catch {
      setError(t("login.networkError"))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <p className="text-xs text-green-600 py-1">{t("userManagement.passwordChanged")}</p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 py-1">
      <Input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={t("setup.passwordPlaceholder")}
        className="h-7 text-xs"
        required
        disabled={loading}
      />
      <Button type="submit" size="xs" disabled={loading || !newPassword}>
        {loading ? <Loader2 className="size-3 animate-spin" /> : t("common.save")}
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={onClose}>
        {t("common.cancel")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  currentUserId,
  onDeleted,
}: {
  user: UserRecord
  currentUserId: string
  onDeleted: (id: string) => void
}) {
  const { t } = useI18n()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  const handleDelete = async () => {
    setDeletingId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
      if (res.ok) onDeleted(user.id)
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  const isSelf = user.id === currentUserId

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{user.username}</span>
          <span
            className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              user.role === "admin"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {user.role === "admin" ? (
              <ShieldCheck className="size-2.5" />
            ) : (
              <User className="size-2.5" />
            )}
            {user.role === "admin"
              ? t("userManagement.roleAdmin")
              : t("userManagement.roleUser")}
          </span>
          {isSelf && (
            <span className="text-[10px] text-muted-foreground">
              ({t("common.me")})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setChangingPassword((v) => !v)}
            title={t("userManagement.changePassword")}
          >
            <KeyRound className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDelete}
            disabled={isSelf || deletingId === user.id}
            title={isSelf ? t("userManagement.cannotDeleteSelf") : t("userManagement.deleteUser")}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
          >
            {deletingId === user.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
      {changingPassword && (
        <ChangePasswordInline
          userId={user.id}
          onClose={() => setChangingPassword(false)}
        />
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/users")
      const data = (await res.json()) as { users?: ApiUser[] }
      setUsers((data.users ?? []) as UserRecord[])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleCreated = (user: UserRecord) => {
    setUsers((prev) => [...prev, user])
  }

  const handleDeleted = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3">{t("userManagement.addUser")}</h3>
        <CreateUserForm onCreated={handleCreated} />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-1">{t("userManagement.userList")}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {t("userManagement.userCount", { count: String(users.length) })}
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="size-4 animate-spin" />
            <span>{t("common.loading")}</span>
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t("userManagement.noUsers")}</p>
        ) : (
          <div className="divide-y divide-border">
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                currentUserId={currentUserId}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
