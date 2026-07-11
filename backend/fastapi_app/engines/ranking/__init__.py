"""Ranking Engine — explainable confidence/quality scoring for strategy results."""

from .scorer import score_launchpad, strength_label

__all__ = ["score_launchpad", "strength_label"]
