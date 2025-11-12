//! Text CRDT: YATA-style collaborative text editing
//!
//! This module implements a production-ready text CRDT based on the YATA
//! (Yet Another Transformation Approach) algorithm, similar to Yjs.
//!
//! # Features
//!
//! - **High performance**: O(1) for sequential typing, O(log n) for random inserts
//! - **Block merging**: Automatically merges adjacent insertions for efficiency
//! - **Deterministic**: Concurrent operations always converge to the same state
//! - **Tombstones**: Deleted items preserved for correct merging
//!
//! # Example
//!
//! ```
//! use synckit_core::crdt::text::Text;
//!
//! let mut text = Text::new(1);
//! text.insert(0, "Hello ");
//! text.insert(6, "World");
//! assert_eq!(text.to_string(), "Hello World");
//!
//! text.delete(5, 6); // Delete " World"
//! assert_eq!(text.to_string(), "Hello");
//! ```
//!
//! # Concurrent Editing
//!
//! ```
//! use synckit_core::crdt::text::Text;
//!
//! // Two clients editing concurrently
//! let mut text1 = Text::new(1);
//! let mut text2 = Text::new(2);
//!
//! text1.insert(0, "Hello");
//! text2.merge(&text1);
//!
//! // Concurrent insertions
//! text1.insert(0, "A");
//! text2.insert(5, "B");
//!
//! // Merge and converge
//! text1.merge(&text2);
//! text2.merge(&text1);
//!
//! assert_eq!(text1.to_string(), text2.to_string());
//! ```

mod id;
mod item;
mod text;

pub use id::ItemId;
pub use item::Item;
pub use text::Text;
