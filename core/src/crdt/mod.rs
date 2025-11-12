//! CRDT (Conflict-free Replicated Data Types) implementations
//!
//! This module contains various CRDT data structures for building collaborative
//! applications without requiring coordination between replicas.
//!
//! # CRDTs Implemented
//!
//! - **PN-Counter:** Positive-Negative Counter for distributed counting
//! - **OR-Set:** Observed-Remove Set for add/remove operations
//! - **Fractional Index:** Position-based list ordering
//! - **Text CRDT:** YATA-style collaborative text editing
//!
//! # References
//!
//! - "A comprehensive study of CRDTs" by Marc Shapiro et al.
//! - "Conflict-free Replicated Data Types" (INRIA Research Report 7687)
//! - "Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types" (YATA)

pub mod pn_counter;
pub mod or_set;
pub mod fractional_index;
pub mod text;

pub use pn_counter::PNCounter;
pub use or_set::ORSet;
pub use fractional_index::FractionalIndex;
pub use text::Text;
