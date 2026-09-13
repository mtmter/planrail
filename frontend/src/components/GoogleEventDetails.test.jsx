import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EventDetailsModal from "./EventDetailsModal";

afterEach(cleanup);

describe("imported Google event details", () => {
  it("keeps Google-owned fields read-only and local route fields editable", () => {
    render(<EventDetailsModal
      event={{
        id: "google-1", source: "google_calendar", title: "Google会議",
        start_at: "2026-09-12T10:00", end_at: "2026-09-12T11:00",
        description: "source description", location_name: "source location",
        destination: "local destination", external: { html_link: "https://calendar.google.com/event" },
      }}
      preparations={[]}
      travelBlocks={[]}
      trips={[]}
      onClose={vi.fn()}
      onDelete={vi.fn()}
      onPreparationAdd={vi.fn()}
      onPreparationDelete={vi.fn()}
      onPreparationUpdate={vi.fn()}
      onCreateTripFromEvent={vi.fn()}
      onTravelBlockSelect={vi.fn()}
      onRouteRegister={vi.fn()}
      onRouteSearch={vi.fn()}
      onRouteSearchSuccess={vi.fn()}
      onUpdate={vi.fn()}
    />);
    expect(screen.getByText("Google Calendarから同期", { exact: false })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByLabelText("予定タイトル").readOnly).toBe(true);
    expect(screen.getByLabelText("説明 任意").readOnly).toBe(true);
    expect(screen.getByLabelText("場所 任意").readOnly).toBe(true);
  });

  it("allows a route re-search after reselecting a location without coordinates", () => {
    render(<EventDetailsModal
      event={{
        id: "event-1", title: "訪問", start_at: "2026-09-12T10:00", end_at: "2026-09-12T11:00",
        location_name: "博多駅", destination: "博多駅",
      }}
      preparations={[]}
      travelBlocks={[]}
      trips={[]}
      onClose={vi.fn()}
      onDelete={vi.fn()}
      onPreparationAdd={vi.fn()}
      onPreparationDelete={vi.fn()}
      onPreparationUpdate={vi.fn()}
      onCreateTripFromEvent={vi.fn()}
      onTravelBlockSelect={vi.fn()}
      onRouteRegister={vi.fn()}
      onRouteSearch={vi.fn()}
      onRouteSearchSuccess={vi.fn()}
      onUpdate={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "行きの経路を検索" }));
    expect(screen.getByLabelText("予定の場所（再選択）")).toBeTruthy();
    expect(screen.getByText("再検索のため、この予定の場所を候補から選択してください。")).toBeTruthy();
  });
});
