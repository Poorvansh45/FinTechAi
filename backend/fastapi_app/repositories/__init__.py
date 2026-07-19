"""
Workspace repository layer.

The ONLY place that touches MongoDB for Workspace collections. Every read/write
is scoped to the authenticated `user_id` here, so ownership can never leak
through a forgetful service or router (single choke-point, easy to test).
"""

from .base import BaseRepository

__all__ = ["BaseRepository"]
