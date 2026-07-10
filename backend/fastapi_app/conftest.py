"""
Pytest bootstrap — ensure the fastapi_app package root is importable so tests
can `import main`, `import config`, `import services...` regardless of the
directory pytest is invoked from.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
