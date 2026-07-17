import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "@/components/shared/data-table";

interface TestItem {
  id: number;
  name: string;
  email: string;
  status: string;
}

const mockData: TestItem[] = [
  { id: 1, name: "John Doe", email: "john@example.com", status: "active" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", status: "inactive" },
  { id: 3, name: "Bob Wilson", email: "bob@example.com", status: "pending" },
];

const mockColumns = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "status", header: "Status" },
];

describe("DataTable", () => {
  it("renders table headers correctly", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders table data correctly", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("displays empty message when data is empty", () => {
    render(
      <DataTable
        columns={mockColumns}
        data={[]}
        emptyMessage="No items found"
      />,
    );

    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("displays default empty message when no emptyMessage prop", () => {
    render(<DataTable columns={mockColumns} data={[]} />);

    expect(screen.getByText("No data found")).toBeInTheDocument();
  });

  it("handles row click events", () => {
    const handleRowClick = vi.fn();
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onRowClick={handleRowClick}
      />,
    );

    const row = screen.getByText("John Doe").closest("tr");
    expect(row).toBeTruthy();
    if (row) {
      // Row click only runs when the gesture started on this row (see DataTable);
      // fireEvent.click alone may not emit mousedown in a way that arms that path.
      fireEvent.mouseDown(row);
      fireEvent.click(row);
    }

    expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it("does not trigger row click when toggling row checkbox", () => {
    const handleRowClick = vi.fn();
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onRowClick={handleRowClick}
        enableRowSelection
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /select row 1/i });
    fireEvent.click(checkbox);
    expect(handleRowClick).not.toHaveBeenCalled();
  });

  it("selects and clears rows via checkboxes", () => {
    render(
      <DataTable columns={mockColumns} data={mockData} enableRowSelection />,
    );

    const selectAll = screen.getByRole("checkbox", {
      name: /select all rows on this page/i,
    });
    fireEvent.click(selectAll);
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "P" && el.textContent === "3 rows selected",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      screen.queryByText(
        (_, el) =>
          el?.tagName === "P" &&
          typeof el.textContent === "string" &&
          el.textContent.includes("selected"),
      ),
    ).not.toBeInTheDocument();
  });

  it("adds cursor-pointer class when onRowClick is provided", () => {
    const handleRowClick = vi.fn();
    const { container } = render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onRowClick={handleRowClick}
      />,
    );

    const dataRows = container.querySelectorAll("tbody tr");
    dataRows.forEach((row) => {
      expect(row).toHaveClass("cursor-pointer");
    });
  });

  it("renders custom column content using render function", () => {
    const columnsWithRender = [
      ...mockColumns.slice(0, -1),
      {
        key: "status",
        header: "Status",
        render: (item: TestItem) => (
          <span data-testid={`status-${item.id}`}>
            {item.status.toUpperCase()}
          </span>
        ),
      },
    ];

    render(<DataTable columns={columnsWithRender} data={mockData} />);

    expect(screen.getByTestId("status-1")).toHaveTextContent("ACTIVE");
    expect(screen.getByTestId("status-2")).toHaveTextContent("INACTIVE");
  });

  it("applies custom className to table container", () => {
    const { container } = render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        className="custom-table-class"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-table-class");
  });

  it("applies column className to cells", () => {
    const columnsWithClass = [
      { key: "id", header: "ID", className: "w-20" },
      { key: "name", header: "Name", className: "font-bold" },
    ];

    const { container } = render(
      <DataTable columns={columnsWithClass} data={[mockData[0]]} />,
    );

    const headers = container.querySelectorAll("th");
    expect(headers[0]).toHaveClass("w-20");
    expect(headers[1]).toHaveClass("font-bold");
  });

  it("renders correct number of rows", () => {
    const { container } = render(
      <DataTable columns={mockColumns} data={mockData} />,
    );

    const dataRows = container.querySelectorAll("tbody tr");
    expect(dataRows).toHaveLength(mockData.length);
  });

  it("handles data with missing keys gracefully", () => {
    const incompleteData = [{ id: 1, name: "Test" }] as TestItem[];

    render(<DataTable columns={mockColumns} data={incompleteData} />);

    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("renders skeleton placeholders when loading", () => {
    const { container } = render(
      <DataTable columns={mockColumns} data={mockData} loading />,
    );

    expect(
      container.querySelectorAll('[data-slot="skeleton"]'),
    ).not.toHaveLength(0);
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(10);
  });
});
