import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";

import { useQuestionDraftsFromDetail } from "@/features/survey/use-question-drafts-from-detail";

type Detail = {
  questions: {
    type: string;
    prompt: string;
    required: boolean;
    options: string[];
  }[];
};

function Probe({ detail }: { detail: Detail | undefined }) {
  const [drafts, setDrafts] = useQuestionDraftsFromDetail(detail);
  return (
    <>
      <Text testID="prompts">
        {drafts.map((draft) => draft.prompt).join("|")}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit first prompt"
        onPress={() => {
          setDrafts((current) =>
            current.map((draft, index) =>
              index === 0 ? { ...draft, prompt: "Edited locally" } : draft,
            ),
          );
        }}
      >
        <Text>Edit</Text>
      </Pressable>
    </>
  );
}

function RemountableProbe({ initial }: { initial: Detail }) {
  const [detail, setDetail] = useState<Detail | undefined>(initial);
  return (
    <>
      <Probe detail={detail} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Load replacement detail"
        onPress={() => {
          setDetail({
            questions: [
              {
                type: "short_text",
                prompt: "From server",
                required: false,
                options: [],
              },
            ],
          });
        }}
      >
        <Text>Replace</Text>
      </Pressable>
    </>
  );
}

describe("useQuestionDraftsFromDetail", () => {
  it("hydrates drafts when detail first becomes available", async () => {
    const detail: Detail = {
      questions: [
        {
          type: "short_text",
          prompt: "Team mood?",
          required: true,
          options: [],
        },
      ],
    };

    const view = await render(<Probe detail={undefined} />);
    expect(screen.getByTestId("prompts")).toHaveTextContent("");

    view.rerender(<Probe detail={detail} />);
    await waitFor(() => {
      expect(screen.getByTestId("prompts")).toHaveTextContent("Team mood?");
    });
  });

  it("preserves local edits until detail identity changes", async () => {
    const detail: Detail = {
      questions: [
        {
          type: "short_text",
          prompt: "Original",
          required: false,
          options: [],
        },
      ],
    };

    await render(<RemountableProbe initial={detail} />);
    expect(screen.getByTestId("prompts")).toHaveTextContent("Original");

    await fireEvent.press(screen.getByLabelText("Edit first prompt"));
    expect(screen.getByTestId("prompts")).toHaveTextContent("Edited locally");

    await fireEvent.press(screen.getByLabelText("Load replacement detail"));
    expect(screen.getByTestId("prompts")).toHaveTextContent("From server");
  });
});
