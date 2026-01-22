#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up worktrees for dual-stream development..."

# Create branches if they don't exist
git branch feature/stream-a 2>/dev/null || echo "Branch feature/stream-a already exists"
git branch feature/stream-b 2>/dev/null || echo "Branch feature/stream-b already exists"

# Create worktrees
STREAM_A_PATH="$REPO_ROOT/../dog-trials-stream-a"
STREAM_B_PATH="$REPO_ROOT/../dog-trials-stream-b"

if [ ! -d "$STREAM_A_PATH" ]; then
    git worktree add "$STREAM_A_PATH" feature/stream-a
    echo "Created Stream A worktree at $STREAM_A_PATH"
else
    echo "Stream A worktree already exists at $STREAM_A_PATH"
fi

if [ ! -d "$STREAM_B_PATH" ]; then
    git worktree add "$STREAM_B_PATH" feature/stream-b
    echo "Created Stream B worktree at $STREAM_B_PATH"
else
    echo "Stream B worktree already exists at $STREAM_B_PATH"
fi

echo ""
echo "Worktrees created successfully!"
echo "  Stream A: $STREAM_A_PATH (API :5100, Web :4200)"
echo "  Stream B: $STREAM_B_PATH (API :5200, Web :4201)"
