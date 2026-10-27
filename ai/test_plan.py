
import json
import math
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# Locate the repository and synthetic fixture.
ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "docs/fixtures/sample-payload.json"

API_URL = "https://api.meta.ai/v1/chat/completions"
MODEL = "muse-spark-1.3"


def main():
    api_key = os.environ.get("MODEL_API_KEY")
    if not api_key:
        raise SystemExit("ERROR: MODEL_API_KEY is not configured.")

    bundle = json.loads(FIXTURE.read_text(encoding="utf-8"))

    event = bundle["opportunity"]
    profile = bundle["profile"]
    goal = profile["goals"][0]

    hours_fact = profile["availableHoursPerWeek"]
    weekly_hours = (
        hours_fact["value"]
        if hours_fact["state"] == "known"
        else None
    )

    # Minimal structured output contract.
    task_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "target": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["goal"]},
                    "goalId": {"type": "string"}
                },
                "required": ["kind", "goalId"],
                "additionalProperties": False
            },
            "priority": {
                "type": "string",
                "enum": ["should", "could"]
            },
            "deliverable": {"type": "string"},
            "completionCriteria": {"type": "string"},
            "estimatedHours": {"type": "number"},
            "resourceIds": {
                "type": "array",
                "items": {"type": "string"}
            }
        },
        "required": [
            "title", "target", "priority", "deliverable",
            "completionCriteria", "estimatedHours", "resourceIds"
        ],
        "additionalProperties": False
    }

    schema = {
        "type": "object",
        "properties": {
            "tasks": {
                "type": "array",
                "items": {
                    **task_schema
                }
            },
            "explanation": {"type": "string"}
        },
        "required": ["tasks", "explanation"],
        "additionalProperties": False
    }

    context = {
        "eventId": event["id"],
        "eventTheme": event["theme"],
        "sourceStatus": event["informationFreshness"],
        "goal": goal,
        "availableHoursPerWeek": weekly_hours,
        "interests": profile["interests"],
        "projectExperience": profile["projectExperience"]
    }

    instructions = (
        "Generate 1 to 3 practical preparation tasks. "
        "Use only the provided synthetic context. "
        "All tasks must target the provided goal ID. "
        "Missing experience does not imply beginner skill level. "
        "Only use should/could priority for goal-based advice. "
        "Use an empty resourceIds array. "
        "Do not invent organizer rules, deadlines, URLs, "
        "eligibility conclusions or achievements. "
        "If weekly hours are known, keep total estimated effort "
        "within one week's reported availability. "
        "An unknown deadline means schedule feasibility is unknown. "
        "Return valid JSON matching the schema."
    )

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": instructions},
            {"role": "user", "content": json.dumps(context)}
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "plan_candidate",
                "schema": schema
            }
        }
    }

    request = Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    print(f"Testing Meta AI: {MODEL}")
    print(f"Fixture: {FIXTURE.name}")

    try:
        with urlopen(request, timeout=90) as response:
            result = json.load(response)

    except HTTPError as error:
        raise SystemExit(f"API failed: HTTP {error.code}")

    except URLError as error:
        raise SystemExit(
            f"Network error: {type(error.reason).__name__}"
        )

    content = result["choices"][0]["message"]["content"]
    output = json.loads(content)

    # Basic application-side semantic validation.
    tasks = output["tasks"]

    assert 1 <= len(tasks) <= 3, "Invalid task count"

    total_hours = 0

    for task in tasks:
        assert task["target"] == {
            "kind": "goal",
            "goalId": goal["id"]
        }, "Unknown task target"

        assert task["resourceIds"] == [], "Unapproved resources"

        assert task["priority"] in (
            "should", "could"
        ), "Unsupported priority"

        hours = task["estimatedHours"]

        assert (
            isinstance(hours, (int, float))
            and not isinstance(hours, bool)
            and math.isfinite(hours)
            and hours > 0
        ), "Invalid effort estimate"

        assert task["title"].strip(), "Missing title"
        assert task["deliverable"].strip(), "Missing deliverable"
        assert task["completionCriteria"].strip(), "Missing criteria"

        total_hours += hours

    if weekly_hours is not None:
        assert (
            total_hours <= weekly_hours
        ), "Tasks exceed weekly availability"

    print("\n=== META AI TEST RESULT ===")
    print(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"\nTotal estimated hours: {total_hours}")
    print("Basic semantic validation: PASS")
    print("Deadline feasibility: NOT VERIFIED")
    print("Full contract validation: NOT TESTED")


if __name__ == "__main__":
    main()
