from pathlib import Path

path = Path("apps/web/app/(dashboard)/admin/roles/page.tsx")
text = path.read_text(encoding="utf-8")
start = text.index("  return (")
end = text.index("      <AnimatePresence>")

new_mid = r'''  return (
    <motion.div
      className="flex min-h-0 flex-col gap-3 pb-20"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="sticky top-0 z-30 -mx-1 space-y-2 border-b border-border/60 bg-background/95 px-1 pb-3 backdrop-blur-md">
        <Breadcrumb>
          <BreadcrumbList>
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Roles & Permissions</h1>
            <p className="text-sm text-muted-foreground">
              Enterprise Role-Based Access Control (RBAC)
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canManage ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg shadow-xs"
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
                  className="h-8 rounded-lg"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 size-3.5" aria-hidden />
                  Import
                </Button>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg">
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
              className="h-8 rounded-lg"
              onClick={() => setAuditOpen(true)}
            >
              <ClipboardList className="mr-1.5 size-3.5" aria-hidden />
              Audit Logs
            </Button>
          </div>
        </div>
      </div>

      <RbacKpiCards
        roles={roles}
        permissions={catalog}
        userStats={userStats}
        isLoading={isLoading || permsLoading || statsLoading}
      />

      <div className="hidden min-h-0 flex-1 lg:block lg:h-[calc(100dvh-13.5rem)]">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full rounded-xl border border-border/70 bg-muted/15 p-1"
        >
          <ResizablePanel defaultSize={28} minSize={24} maxSize={38} id="roles-list">
            <div className="h-full p-0.5">
              <RoleListPanel
                roles={roles}
                selectedId={selected?.id ?? null}
                userCounts={userCounts}
                isLoading={isLoading}
                onSelect={selectRole}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-0.5 w-1.5 rounded-full bg-border" />
          <ResizablePanel defaultSize={72} minSize={55} id="roles-detail">
            <div className="h-full p-0.5">
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
                <div className="flex h-full items-center justify-center rounded-xl border bg-card">
                  <EmptyState
                    title="Select a role"
                    description="Choose a role to manage its permission matrix."
                    className="py-12"
                  />
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="space-y-3 lg:hidden">
        <RoleListPanel
          roles={roles}
          selectedId={selected?.id ?? null}
          userCounts={userCounts}
          isLoading={isLoading}
          onSelect={selectRole}
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
        ) : null}
      </div>

'''

path.write_text(text[:start] + new_mid + text[end:], encoding="utf-8")
print("patched ok")
