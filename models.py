#Ezekiel Tan 241764L Tut_02
# models.py
from functools import total_ordering
from datetime import datetime

@total_ordering
class RequestWrapper:
    """Wrapper class for priority queue operations"""
    def __init__(self, priority, request):
        self.priority = priority
        self.request = request
        self.timestamp = request['timestamp']

    def __lt__(self, other):
        """Compare by priority, then by timestamp"""
        if self.priority == other.priority:
            return datetime.fromisoformat(self.timestamp) < datetime.fromisoformat(other.timestamp)
        return self.priority < other.priority

    def __eq__(self, other):
        return (self.priority == other.priority and
                self.timestamp == other.timestamp)