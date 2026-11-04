import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExperienceHelper } from "@/components/profile/ExperienceHelper";
import { demoProfileService } from "@/test/fixtures/profile-service";

afterEach(cleanup);
it("keeps demo wording and skills unconfirmed until explicitly accepted, and rejects stale suggestions", async () => {
  const project = {
    id: "one",
    title: "A project",
    description: "",
    contribution: "I designed the search screen.",
    technologies: ["React"],
    url: "",
  };
  const accept = vi.fn();
  const view = render(
    <ExperienceHelper
      project={project}
      service={demoProfileService}
      fail={false}
      onAccept={accept}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Help describe my experience" }));
  await screen.findByText("Review before adding");
  expect(accept).not.toHaveBeenCalled();
  const skills = screen.getByRole("checkbox", { name: "React" });
  expect(skills).not.toBeChecked();
  fireEvent.click(skills);
  fireEvent.change(screen.getByLabelText("Proposed wording · edit freely"), {
    target: { value: "I designed a search screen for our project." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Accept into my draft" }));
  expect(accept).toHaveBeenCalledWith("I designed a search screen for our project.", ["React"]);
  fireEvent.click(screen.getByRole("button", { name: "Help describe my experience" }));
  await screen.findByText("Review before adding");
  view.rerender(
    <ExperienceHelper
      project={{ ...project, contribution: "I tested the application instead." }}
      service={demoProfileService}
      fail={false}
      onAccept={accept}
    />,
  );
  expect(screen.getByRole("button", { name: "Accept into my draft" })).toBeDisabled();
});
