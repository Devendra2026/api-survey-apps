from pathlib import Path

path = Path("apps/web/app/(dashboard)/admin/roles/page.tsx")
text = path.read_text(encoding="utf-8")

# Remove unused Resizable imports if present
text = text.replace(
    'import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable"\n',
    "",
)

start = text.index('  return (\n    <motion.div')
# Find the second return after handlers - should be main return
# Prefer the return after matrixReadOnly
marker = "  const matrixReadOnly = !canManage || !isEditing\n\n  return ("
if marker not in text:
    raise SystemExit("marker not found")
start = text.index(marker) + len("  const matrixReadOnly = !canManage || !isEditing\n\n")
end = text.index("      <AnimatePresence>")

new_return = r'''  return (
    <motion.div
      className="flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col gap-2 overflow-hidden pb-16 md:h-[calc(100dvh-8rem)] md:pb-2"
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Single-row sticky toolbar — Data-Dense Dashboard */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border/50 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin/users">Administration</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Roles & Permissions</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <h1 className="text-lg font-semibold tracking-tight md:text-xl">Roles & Permissions</h1>
            <p className="text-xs text-muted-foreground">Enterprise RBAC</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {canManage ? (
            <Button
              type="button"
              size="sm"
              className="h-8 cursor-pointer rounded-lg shadow-xs"
              onClick={() => {
                setName("")
                setDescription("")
                setCreateOpen(true)
              }}
            >
              <Plus className="mr-1.5 size-3.5" aria-hidden />
              Create Role
            </Button>
          ) : null}
          {canManage ? (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void importRolesFile(file)
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer rounded-lg"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="mr-1.5 size-3.5" aria-hidden />
                Import
              </Button>
            </>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer rounded-lg">
                <Download className="mr-1.5 size-3.5" aria-hidden />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem className="cursor-pointer" onClick={exportRoles}>
                <FileUp className="mr-2 size-3.5" />
                Export roles JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer rounded-lg"
            onClick={() => setAuditOpen(true)}
          >
            <ClipboardList className="mr-1.5 size-3.5" aria-hidden />
            Audit Logs
          </Button>
        </div>
      </div>

      <div className="shrink-0">
        <RbacKpiCards
          roles={roles}
          permissions={catalog}
          userStats={userStats}
          isLoading={isLoading || permsLoading || statsLoading}
        />
      </div>

      {/* 28% / 72% CSS grid — fills remaining viewport, no empty bands */}
      <div className="hidden min-h-0 flex-1 grid-cols-[minmax(260px,28%)_minmax(0,1fr)] gap-2 lg:grid">
        <RoleListPanel
          roles={roles}
          selectedId={selected?.id ?? null}
          userCounts={userCounts}
          isLoading={isLoading}
          onSelect={selectRole}
          canCreate={canManage}
          onCreateRole={() => {
            setName("")
            setDescription("")
            setCreateOpen(true)
          }}
        />
        {selected ? (
          <RoleDetailPanel
            role={selected}
            tab={tab}
            onTabChange={setTab}
            canManage={canManage}
            isEditing={isEditing}
            onEdit={() => {
              setName(selected.name)
              setDescription(selected.description ?? "")
              setEditOpen(true)
            }}
            onClone={() => {
              setName(`${selected.name}_COPY`)
              setDescription(selected.description ?? "")
              setCloneOpen(true)
            }}
            onAssign={() => setAssignOpen(true)}
            onDelete={async () => {
              try {
                await deleteRole.mutateAsync(selected.id)
                toast.success("Role deleted")
                setSelectedId(null)
              } catch (error) {
                toast.error(getApiErrorMessage(error))
              }
            }}
            onStartEditPermissions={() => {
              if (!canManage) return
              setIsEditing(true)
              setTab("permissions")
              toast.message("Edit mode enabled — update the matrix, then Save")
            }}
            roleUsers={roleUsers}
            roleUsersLoading={roleUsersLoading}
            matrix={
              <PermissionMatrixTable
                permissions={catalog}
                selectedIds={draftIds}
                readOnly={matrixReadOnly}
                onChange={(next) => {
                  setDraftIds(next)
                  if (!isEditing) setIsEditing(true)
                }}
              />
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border bg-card">
            <EmptyState
              title="Select a role"
              description="Choose a role to manage its permission matrix."
              className="py-10"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto lg:hidden">
        <RoleListPanel
          roles={roles}
          selectedId={selected?.id ?? null}
          userCounts={userCounts}
          isLoading={isLoading}
          onSelect={selectRole}
          canCreate={canManage}
          onCreateRole={() => {
            setName("")
            setDescription("")
            setCreateOpen(true)
          }}
        />
        {selected ? (
          <div className="min-h-[480px]">
            <RoleDetailPanel
              role={selected}
              tab={tab}
              onTabChange={setTab}
              canManage={canManage}
              isEditing={isEditing}
              onEdit={() => {
                setName(selected.name)
                setDescription(selected.description ?? "")
                setEditOpen(true)
              }}
              onClone={() => {
                setName(`${selected.name}_COPY`)
                setDescription(selected.description ?? "")
                setCloneOpen(true)
              }}
              onAssign={() => setAssignOpen(true)}
              onDelete={async () => {
                try {
                  await deleteRole.mutateAsync(selected.id)
                  toast.success("Role deleted")
                  setSelectedId(null)
                } catch (error) {
                  toast.error(getApiErrorMessage(error))
                }
              }}
              onStartEditPermissions={() => {
                if (!canManage) return
                setIsEditing(true)
                setTab("permissions")
              }}
              roleUsers={roleUsers}
              roleUsersLoading={roleUsersLoading}
              matrix={
                <PermissionMatrixTable
                  permissions={catalog}
                  selectedIds={draftIds}
                  readOnly={matrixReadOnly}
                  onChange={(next) => {
                    setDraftIds(next)
                    if (!isEditing) setIsEditing(true)
                  }}
                />
              }
            />
          </div>
        ) : null}
      </div>

'''

path.write_text(text[:start] + new_return + text[end:], encoding="utf-8")
print("page layout patched")
