from django.test import TestCase
from rest_framework import serializers

from moss import event_types
from moss.validators import validate_event_payload


class EndEventValidatorTestCase(TestCase):
    def test_end_set_accepts_boundary_from_two(self):
        validate_event_payload(event_types.EVENT_END_SET, {"boundary_before_question": 2})

    def test_end_set_rejects_start_boundary_and_missing_boundary(self):
        for payload in ({"boundary_before_question": 1}, {"boundary_before_question": "5"}, {}):
            with self.subTest(payload=payload):
                with self.assertRaises(serializers.ValidationError):
                    validate_event_payload(event_types.EVENT_END_SET, payload)

    def test_end_cleared_accepts_empty_payload(self):
        validate_event_payload(event_types.EVENT_END_CLEARED, {})
