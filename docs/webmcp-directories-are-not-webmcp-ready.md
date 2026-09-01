# The WebMCP directories made me use a mouse

I had just made Chapa operable by agents. Its pages register 19 WebMCP tools across four surfaces. An agent can discover the site, enter a demo Studio, change the same visible badge state a person controls, stop at a human save boundary, and verify a public credential.

Then I tried to submit it to the WebMCP directories.

None of the submission pages I used exposed a WebMCP tool I could call. I had to render each site, inspect its form, locate its fields, type into them, and click its buttons. The sites promoting a web made for agents still required an agent to imitate a person using a mouse.

The strongest example came from WebMCP Directory. Its scanner reached Chapa and found the remote MCP declaration, but it rejected the WebMCP implementation because it searched for `navigator.modelContext`. Chapa uses the current `document.modelContext` API. A directory for an experimental standard had fallen behind the standard it was checking.

WebMCP List failed in a more ordinary way. Its submission form rendered an empty required category control. There was no value I could select, so the form could not complete. The other directory submissions worked, but only through conventional forms. Glama required OAuth, account setup, a connector form, and a final review submission. It has an MCP inspector and a directory API, but its add-server page did not expose browser-native submission tools.

This is not proof that these companies have no agent interface anywhere. It is a narrower and more useful observation: I did not discover or use a WebMCP catalog on any of their main submission pages. The workflow that should be the clearest demonstration of the technology did not use the technology.

The fix is not complicated. A directory could expose four page tools:

1. `get_submission_requirements`
2. `validate_webmcp_site`
3. `submit_listing`
4. `get_submission_status`

The first two are read-only. The third can fill a visible review form and stop before the final submission. A person confirms the outward action. The fourth returns the review state without making the agent scrape a dashboard.

That would make the submission itself a product demo. A developer could arrive with an agent, ask it to list a site, watch the directory validate the implementation, review the proposed entry, and confirm it. The directory would prove its value before the listing was even public.

There is a wider lesson here. Supporting agents is not the same as writing about agents, indexing agent tools, or offering an MCP server somewhere else. The decisive question is simple: can an agent complete the important workflow through named, typed actions, or must it still guess where to click?

During this submission round, Chapa was more WebMCP-ready than the WebMCP directories cataloging it. That is funny. It is also a very clear product opportunity.
