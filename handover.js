const harnesses = {
  alex: {
    title: "AI harness: Engineering Productivity Setup",
    skills: ["pr-review", "release-notes", "flaky-test-triage", "migration-check", "incident-summary", "api-contract-check", "onboarding-guide", "dependency-audit"],
    servers: ["repo", "issue-tracker", "error-monitoring"],
    contextCount: 12,
    context: ["api-conventions.md", "release-checklist.md", "incident-playbook.md"],
    team: "Engineering Team",
    receiver: "Sam, Engineer (new)"
  },
  priya: {
    title: "AI harness: Platform Operations Setup",
    skills: ["deploy-check", "runbook-lookup", "cost-report", "oncall-handoff", "terraform-plan-review"],
    servers: ["cloud-console", "paging"],
    contextCount: 7,
    context: ["deployment-runbook.md", "oncall-checklist.md", "infrastructure-conventions.md"],
    team: "Platform Team",
    receiver: "Ken, Platform engineer"
  }
};

for (const preview of document.querySelectorAll("[data-handover]")) {
  const people = preview.querySelector(".handover-people");
  const tablist = preview.querySelector(".handover-tabs");
  const tabs = [...tablist.querySelectorAll("[data-tab]")];
  const panels = [...preview.querySelectorAll("[data-panel]")];
  const setText = (selector, value) => {
    preview.querySelector(selector).textContent = value;
  };
  const setList = (selector, values) => {
    preview.querySelector(selector).replaceChildren(...values.map(value => {
      const item = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = value;
      item.append(code);
      return item;
    }));
  };
  const selectTab = (selected, focus = false) => {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.panel !== selected.dataset.tab;
    if (focus) selected.focus();
  };
  const selectEmployee = employee => {
    const harness = harnesses[employee];
    setText("[data-harness-title]", harness.title);
    setText("[data-skill-count]", harness.skills.length);
    setText("[data-server-count]", harness.servers.length);
    setText("[data-context-count]", `${harness.contextCount} items`);
    setText("[data-context-total]", `${harness.contextCount} items`);
    setText("[data-team]", harness.team);
    setText("[data-receiver]", harness.receiver);
    setList("[data-skills]", harness.skills);
    setList("[data-servers]", harness.servers);
    setList("[data-context]", harness.context);
    for (const summary of preview.querySelectorAll("[data-summary]")) {
      summary.hidden = summary.dataset.summary !== employee;
    }
  };

  tablist.setAttribute("role", "tablist");
  for (const tab of tabs) {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `panel-${tab.dataset.tab}`);
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", event => {
      let index = tabs.indexOf(tab);
      if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") index = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") index = 0;
      else if (event.key === "End") index = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[index], true);
    });
  }
  for (const panel of panels) {
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `tab-${panel.dataset.panel}`);
    panel.tabIndex = 0;
  }
  for (const radio of people.querySelectorAll('input[name="employee"]')) {
    radio.addEventListener("change", () => {
      if (radio.checked) selectEmployee(radio.value);
    });
  }
  selectTab(tabs[0]);
  people.hidden = false;
  tablist.hidden = false;
}
