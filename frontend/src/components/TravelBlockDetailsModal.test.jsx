import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TravelBlockDetailsModal from "./TravelBlockDetailsModal";

afterEach(cleanup);

describe("travel block route re-search", () => {
  it("asks to reselect a saved endpoint without coordinates", () => {
    render(<TravelBlockDetailsModal
      travelBlock={{
        id: "travel-1",
        title: "自宅 → 博多駅",
        start_at: "2026-09-12T09:00",
        end_at: "2026-09-12T10:00",
        origin: { name: "自宅" },
        destination: { name: "博多駅" },
      }}
      trips={[]}
      onClose={vi.fn()}
      onDelete={vi.fn()}
      onDirectRouteRegister={vi.fn()}
      onDirectRouteSearch={vi.fn()}
      onUpdate={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "前区間を検索" }));
    expect(screen.getByLabelText("移動の到着地（再選択）")).toBeTruthy();
    expect(screen.getByText("再検索のため、保存済み地点を候補から選択してください。")).toBeTruthy();
  });
});
