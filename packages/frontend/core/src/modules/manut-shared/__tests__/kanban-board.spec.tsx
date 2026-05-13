/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { KanbanBoard, type KanbanOnMoveArgs } from '../components/kanban-board';

interface DummyCard {
  id: string;
  title: string;
}

interface RenderArgs {
  onMove?: (args: KanbanOnMoveArgs) => Promise<void> | void;
}

function renderBoard({ onMove = vi.fn() }: RenderArgs = {}) {
  const columns = [
    {
      id: 'todo',
      label: 'To do',
      cards: [
        { id: 'card-a', title: 'A' },
        { id: 'card-b', title: 'B' },
      ],
    },
    {
      id: 'doing',
      label: 'Doing',
      cards: [{ id: 'card-c', title: 'C' }],
    },
    {
      id: 'done',
      label: 'Done',
      cards: [] as DummyCard[],
    },
  ];

  const utils = render(
    <KanbanBoard<DummyCard>
      columns={columns}
      renderCard={card => <span>{card.title}</span>}
      onMove={onMove}
      testIdPrefix="kb"
    />
  );

  return { ...utils, onMove };
}

/**
 * Simulate the HTML5 drag-drop sequence happy-dom understands. We hand-roll
 * a tiny DataTransfer mock because happy-dom's stub doesn't round-trip the
 * `setData` / `getData` pair reliably.
 */
function dragAndDrop(
  card: HTMLElement,
  target: HTMLElement,
  payload: { cardId: string; fromColumn: string }
) {
  const store = new Map<string, string>();
  const dataTransfer = {
    setData: (mime: string, value: string) => store.set(mime, value),
    getData: (mime: string) => store.get(mime) ?? '',
    setDragImage: () => undefined,
    effectAllowed: 'move',
    dropEffect: 'move',
    types: [] as string[],
  } as unknown as DataTransfer;

  // We seed the store ahead of dispatch because some happy-dom versions
  // don't propagate `setData` calls through `fireEvent.dragStart`.
  store.set('application/x-manut-kanban-card', JSON.stringify(payload));

  fireEvent.dragStart(card, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  fireEvent.dragEnd(card, { dataTransfer });
}

describe('KanbanBoard', () => {
  afterEach(() => cleanup());

  test('renders one column per configured stage with labels and cards', () => {
    renderBoard();

    expect(screen.getByTestId('kb-column-todo')).toBeTruthy();
    expect(screen.getByTestId('kb-column-doing')).toBeTruthy();
    expect(screen.getByTestId('kb-column-done')).toBeTruthy();

    expect(screen.getByText('To do')).toBeTruthy();
    expect(screen.getByText('Doing')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();

    expect(screen.getByTestId('kb-card-card-a')).toBeTruthy();
    expect(screen.getByTestId('kb-card-card-b')).toBeTruthy();
    expect(screen.getByTestId('kb-card-card-c')).toBeTruthy();
  });

  test('calls onMove with the destination column when a card is dropped on another column', () => {
    const onMove = vi.fn();
    renderBoard({ onMove });

    const card = screen.getByTestId('kb-card-card-a');
    const doneColumn = screen.getByTestId('kb-column-done');

    dragAndDrop(card, doneColumn, { cardId: 'card-a', fromColumn: 'todo' });

    expect(onMove).toHaveBeenCalledTimes(1);
    const callArgs = onMove.mock.calls[0]?.[0] as KanbanOnMoveArgs;
    expect(callArgs.cardId).toBe('card-a');
    expect(callArgs.fromColumn).toBe('todo');
    expect(callArgs.toColumn).toBe('done');
    expect(callArgs.toIndex).toBe(0);
  });

  test('skips onMove when a card is dropped at its original position', () => {
    const onMove = vi.fn();
    renderBoard({ onMove });

    const card = screen.getByTestId('kb-card-card-a');
    const sourceColumn = screen.getByTestId('kb-column-todo');

    dragAndDrop(card, sourceColumn, { cardId: 'card-a', fromColumn: 'todo' });

    // The card landed back in the same column without a more specific slot
    // hover -> the board considers this a no-op.
    expect(onMove).not.toHaveBeenCalled();
  });

  test('renders empty-state copy in columns with no cards', () => {
    render(
      <KanbanBoard
        columns={[{ id: 'a', label: 'A', cards: [] }]}
        renderCard={() => null}
        onMove={() => undefined}
        emptyText="Nothing here yet"
        testIdPrefix="empty-board"
      />
    );

    expect(screen.getByText('Nothing here yet')).toBeTruthy();
  });
});
