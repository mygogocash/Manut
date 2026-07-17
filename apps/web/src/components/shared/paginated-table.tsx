"use client";

import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable, type DataTableProps } from "@/components/shared/data-table";
import { useClientPagination } from "@/hooks/use-client-pagination";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

type DataTablePassthroughProps<T> = Pick<
  DataTableProps<T>,
  | "enableRowSelection"
  | "getRowId"
  | "selectedRowIds"
  | "onSelectedRowIdsChange"
  | "selectionActions"
  | "skeletonRows"
>;

interface PaginatedTableProps<T> extends DataTablePassthroughProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
}

/**
 * Convenience wrapper around `DataTable` that paginates an in-memory array on
 * the client. Use `DataTable` directly when paging is server-driven.
 */
export function PaginatedTable<T>({
  columns,
  data,
  onRowClick,
  emptyMessage,
  className,
  title,
  actions,
  loading,
  pageSize: initialPageSize = 10,
  pageSizeOptions,
  enableRowSelection,
  getRowId,
  selectedRowIds,
  onSelectedRowIdsChange,
  selectionActions,
  skeletonRows,
}: PaginatedTableProps<T>) {
  const {
    page,
    pageSize,
    totalCount,
    totalPages,
    pageItems,
    setPage,
    setPageSize,
  } = useClientPagination(data, initialPageSize);

  return (
    <DataTable
      columns={columns}
      data={pageItems}
      onRowClick={onRowClick}
      emptyMessage={emptyMessage}
      className={className}
      title={title}
      actions={actions}
      loading={loading}
      enableRowSelection={enableRowSelection}
      getRowId={getRowId}
      selectedRowIds={selectedRowIds}
      onSelectedRowIdsChange={onSelectedRowIdsChange}
      selectionActions={selectionActions}
      skeletonRows={skeletonRows}
      pagination={
        totalCount > pageSize ? (
          <DataPagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            pageSizeOptions={pageSizeOptions}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : undefined
      }
    />
  );
}
