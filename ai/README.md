# Meta AI Integration — Development Spike

## Overview

Initial Meta Model API integration experiment for the
Meta Hackathon 2026 MVP.

This script generates preparation-plan candidates using
Muse Spark 1.3 and a synthetic student profile.

## Requirements

- Python 3
- Meta Model API access
- MODEL_API_KEY environment variable

No additional Python packages are required.

## Run

From the repository root:

1. Set MODEL_API_KEY securely in your terminal.
2. Run:

   python3 ai/test_plan.py

3. Clear the key after testing:

   unset MODEL_API_KEY

Never commit API keys or real credentials.

## Input

docs/fixtures/sample-payload.json

Contains synthetic opportunity and student-profile data.

## Output

- Structured preparation-plan candidate
- Goal reference validation
- Resource ID validation
- Positive effort checks
- Weekly availability check

## Current Limitations

- Development experiment, not production integration
- Only supports synthetic goal-based tasks
- No ASP.NET Core integration yet
- No persistence
- No verified deadline feasibility
- No full runtime contract validation
- No comprehensive AI quality evaluation

## Ownership

Rofi — Meta AI Integration

Noor — Backend integration and application orchestration
