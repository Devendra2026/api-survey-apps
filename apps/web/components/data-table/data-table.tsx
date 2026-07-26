"use client"

import { EmptyState } from "@/components/shared/page-elements"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown, Columns3 } from "lucide-react"
import * as React from "react"

export interface DataTablePagination {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  pageSize?: number
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  toolbar?: React.ReactNode
  footerToolbar?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  pagination?: DataTablePagination
  className?: string
  enableRowSelection?: boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  getRowId?: (originalRow: TData, index: number) => string
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  columnOrder?: ColumnOrderState
  onColumnOrderChange?: OnChangeFn<ColumnOrderState>
  stickyFirstColumns?: number
  maxHeightClassName?: string
  virtualizeThreshold?: number
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  toolbar,
  footerToolbar,
  emptyTitle = "No results",
  emptyDescription,
  pagination,
  className,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  columnVisibility,
  onColumnVisibilityChange,
  columnOrder,
  onColumnOrderChange,
  stickyFirstColumns = 0,
  maxHeightClassName = "max-h-[min(70vh,720px)]",
  virtualizeThreshold = 80,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [internalVisibility, setInternalVisibility] = React.useState<VisibilityState>({})
  const [internalSelection, setInternalSelection] = React.useState<RowSelectionState>({})
  const [internalOrder, setInternalOrder] = React.useState<ColumnOrderState>([])
  const [focusedRow, setFocusedRow] = React.useState(0)
  const tableRef = React.useRef<HTMLDivElement>(null)

  const visibility = columnVisibility ?? internalVisibility
  const setVisibility = onColumnVisibilityChange ?? setInternalVisibility
  const selection = rowSelection ?? internalSelection
  const setSelection = onRowSelectionChange ?? setInternalSelection
  const order = columnOrder ?? internalOrder
  const setOrder = onColumnOrderChange ?? setInternalOrder

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unstable function identities
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility: visibility,
      columnOrder: order,
      ...(enableRowSelection ? { rowSelection: selection } : {}),
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onColumnOrderChange: setOrder,
    onRowSelectionChange: enableRowSelection ? setSelection : undefined,
    enableRowSelection,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: Boolean(pagination),
  })

  const rows = table.getRowModel().rows
  const selectedCount = enableRowSelection ? table.getSelectedRowModel().rows.length : 0
  const shouldVirtualize = rows.length >= virtualizeThreshold
  const rowHeight = 44
  const [scrollTop, setScrollTop] = React.useState(0)
  const viewportHeight = 640
  const startIndex = shouldVirtualize ? Math.max(0, Math.floor(scrollTop / rowHeight) - 5) : 0
  const endIndex = shouldVirtualize
    ? Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 5)
    : rows.length
  const visibleRows = shouldVirtualize ? rows.slice(startIndex, endIndex) : rows
  const topPad = shouldVirtualize ? startIndex * rowHeight : 0
  const bottomPad = shouldVirtualize ? Math.max(0, (rows.length - endIndex) * rowHeight) : 0

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!tableRef.current?.contains(document.activeElement) && document.activeElement !== tableRef.current) {
        return
      }
      if (!rows.length) return
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setFocusedRow((current) => Math.min(rows.length - 1, current + 1))
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setFocusedRow((current) => Math.max(0, current - 1))
      }
      if (event.key === " " && enableRowSelection) {
        event.preventDefault()
        rows[focusedRow]?.toggleSelected()
      }
      if (event.key === "Enter") {
        const link = tableRef.current?.querySelector<HTMLAnchorElement>(`[data-row-index="${focusedRow}"] a[href]`)
        link?.click()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enableRowSelection, focusedRow, rows])

  const moveColumn = (columnId: string, direction: -1 | 1) => {
    const current = order.length ? [...order] : table.getAllLeafColumns().map((column) => column.id)
    const index = current.indexOf(columnId)
    if (index < 0) return
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= current.length) return
    const next = [...current]
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(nextIndex, 0, item)
    setOrder(next)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {onSearchChange ? (
            <Input
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 max-w-xs"
            />
          ) : null}
          {toolbar}
        </div>
        <div className="flex items-center gap-2">
          {enableRowSelection && selectedCount > 0 ? (
            <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 cursor-pointer">
                <Columns3 className="size-3.5" />
                Columns
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Toggle / reorder</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <div key={col.id} className="flex items-center gap-1 px-1">
                    <DropdownMenuCheckboxItem
                      className="capitalize"
                      checked={col.getIsVisible()}
                      onCheckedChange={(value) => col.toggleVisibility(Boolean(value))}
                    >
                      {col.id}
                    </DropdownMenuCheckboxItem>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => moveColumn(col.id, -1)}
                      aria-label={`Move ${col.id} left`}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => moveColumn(col.id, 1)}
                      aria-label={`Move ${col.id} right`}
                    >
                      ↓
                    </Button>
                  </div>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {footerToolbar}

      <div
        ref={tableRef}
        tabIndex={0}
        className="overflow-hidden rounded-xl border outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Data table"
      >
        <div
          className={cn("overflow-auto", maxHeightClassName)}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap",
                        index < stickyFirstColumns &&
                          "sticky left-0 z-30 bg-background shadow-[1px_0_0_0_hsl(var(--border))]"
                      )}
                      style={index < stickyFirstColumns ? { left: index === 0 ? 0 : undefined } : undefined}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length ? (
                <>
                  {topPad > 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} style={{ height: topPad }} className="p-0" />
                    </TableRow>
                  ) : null}
                  {visibleRows.map((row, visibleIndex) => {
                    const absoluteIndex = shouldVirtualize ? startIndex + visibleIndex : visibleIndex
                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        data-row-index={absoluteIndex}
                        className={cn(absoluteIndex === focusedRow && "bg-muted/50")}
                        onMouseEnter={() => setFocusedRow(absoluteIndex)}
                      >
                        {row.getVisibleCells().map((cell, index) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              "whitespace-nowrap",
                              index < stickyFirstColumns &&
                                "sticky left-0 z-10 bg-background shadow-[1px_0_0_0_hsl(var(--border))]"
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                  {bottomPad > 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} style={{ height: bottomPad }} className="p-0" />
                    </TableRow>
                  ) : null}
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDescription}
                      className="rounded-none border-0 py-12"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {pagination ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {pagination.total.toLocaleString()} total · Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            {shouldVirtualize ? " · Virtualized rows" : ""}
          </p>
          <div className="flex items-center gap-2">
            {pagination.onPageSizeChange ? (
              <Select
                value={String(pagination.pageSize ?? 20)}
                onValueChange={(value) => pagination.onPageSizeChange?.(Number(value))}
              >
                <SelectTrigger className="h-8 w-22">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(pagination.pageSizeOptions ?? [20, 50, 100]).map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}/page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function DataTableSelectColumn<TData>(): ColumnDef<TData> {
  return {
    id: "select",
    enableHiding: false,
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        aria-label="Select row"
      />
    ),
  }
}
