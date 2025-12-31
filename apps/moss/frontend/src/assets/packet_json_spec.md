# Sample Packet JSON Format

This packet format wraps a list of question objects with minimal metadata.

## Top-level object
- `packet` (string): Packet name, e.g. `"Round 1"`.
- `year` (number): Competition year.
- `questions` (array): List of question objects in tossup/bonus order.

## Question object
- `id` (integer): Unique per question within the packet.
- `pair_id` (integer): Shared between paired tossup/bonus (1 for Q1/Q2, 2 for Q3/Q4, etc.).
- `question_type` (string enum): `TOSSUP` or `BONUS`.
- `question_style` (string enum): `MULTIPLE_CHOICE`, `SHORT_ANSWER`, `IDENTIFY_ALL`, `RANK`.
- `category` (string enum): `BIOLOGY`, `CHEMISTRY`, `EARTH_SPACE`, `ENERGY`, `MATH`, `PHYSICS`.
- `question_text` (string): The prompt.
- `options` (array of strings): Answer choices when applicable; empty for short answer.
- `correct_answer`:
  - `MULTIPLE_CHOICE`: string one of `W`, `X`, `Y`, `Z`.
  - `IDENTIFY_ALL`: array of integers indicating all correct option numbers.
  - `RANK`: array of integers giving the order of options.
  - `SHORT_ANSWER`: string.
- `source` (string, optional): Packet source label.

## Example
```json
{
  "packet": "Round 1",
  "year": 2025,
  "questions": [
    {
      "id": 1,
      "pair_id": 1,
      "question_type": "TOSSUP",
      "question_style": "MULTIPLE_CHOICE",
      "category": "EARTH_SPACE",
      "question_text": "The Alps in northern Italy are an example of which of the following types of tectonic boundaries?",
      "options": [
        "Continental-continental convergence",
        "Continental-oceanic convergence",
        "Oceanic-oceanic convergence",
        "Continental-continental divergence"
      ],
      "correct_answer": "W",
      "source": "MIT_2025"
    }
  ]
}
```
