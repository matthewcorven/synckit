//! Item: The fundamental building block of the Text CRDT
//!
//! Each item represents a character (or block of characters) with:
//! - Unique ID
//! - Content
//! - Left/right origins for conflict resolution
//! - Deleted flag (tombstone)

use super::id::ItemId;
use serde::{Deserialize, Serialize};

/// A single item in the text CRDT
///
/// Items form a linked structure where each item knows:
/// - What it was inserted after (left origin)
/// - What it was inserted before (right origin)
///
/// This enables deterministic conflict resolution when multiple
/// clients insert at the same position concurrently.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    /// Unique identifier for this item
    pub id: ItemId,
    
    /// The actual content (single character or merged block)
    pub content: String,
    
    /// Item this was inserted after (None for first item)
    pub left: Option<ItemId>,
    
    /// Item this was inserted before (None for append)
    pub right: Option<ItemId>,
    
    /// Whether this item has been deleted
    pub deleted: bool,
    
    /// Client that created this item (redundant with id.client but convenient)
    pub client: u64,
}

impl Item {
    /// Create a new item
    pub fn new(
        id: ItemId,
        content: String,
        left: Option<ItemId>,
        right: Option<ItemId>,
    ) -> Self {
        Self {
            client: id.client,
            id,
            content,
            left,
            right,
            deleted: false,
        }
    }
    
    /// Create a new item with a single character
    pub fn new_char(
        id: ItemId,
        ch: char,
        left: Option<ItemId>,
        right: Option<ItemId>,
    ) -> Self {
        Self::new(id, ch.to_string(), left, right)
    }
    
    /// Get the length of this item's content
    pub fn len(&self) -> usize {
        self.content.len()
    }
    
    /// Check if this item is empty
    pub fn is_empty(&self) -> bool {
        self.content.is_empty()
    }
    
    /// Mark this item as deleted
    pub fn delete(&mut self) {
        self.deleted = true;
    }
    
    /// Check if this item can be merged with another
    ///
    /// Items can be merged if:
    /// - Same client
    /// - Sequential IDs
    /// - Same deletion status
    /// - Adjacent in the list
    pub fn can_merge_with(&self, other: &Item) -> bool {
        self.client == other.client
            && self.deleted == other.deleted
            && self.id.clock + 1 == other.id.clock
            && self.right == Some(other.id)
    }
    
    /// Merge another item into this one
    ///
    /// Assumes can_merge_with returned true
    pub fn merge(&mut self, other: &Item) {
        self.content.push_str(&other.content);
        self.right = other.right;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_item_creation() {
        let id = ItemId::new(1, 10);
        let item = Item::new_char(id, 'a', None, None);
        
        assert_eq!(item.id, id);
        assert_eq!(item.content, "a");
        assert_eq!(item.left, None);
        assert_eq!(item.right, None);
        assert!(!item.deleted);
    }
    
    #[test]
    fn test_item_deletion() {
        let id = ItemId::new(1, 10);
        let mut item = Item::new_char(id, 'a', None, None);
        
        assert!(!item.deleted);
        item.delete();
        assert!(item.deleted);
    }
    
    #[test]
    fn test_item_merge_conditions() {
        let id1 = ItemId::new(1, 10);
        let id2 = ItemId::new(1, 11);
        let id3 = ItemId::new(2, 11);
        
        let item1 = Item::new_char(id1, 'a', None, Some(id2));
        let item2 = Item::new_char(id2, 'b', Some(id1), None);
        let item3 = Item::new_char(id3, 'c', None, None);
        
        // Sequential items from same client
        assert!(item1.can_merge_with(&item2));
        
        // Different clients
        assert!(!item2.can_merge_with(&item3));
    }
    
    #[test]
    fn test_item_merge() {
        let id1 = ItemId::new(1, 10);
        let id2 = ItemId::new(1, 11);
        let id3 = ItemId::new(1, 12);
        
        let mut item1 = Item::new_char(id1, 'a', None, Some(id2));
        let item2 = Item::new_char(id2, 'b', Some(id1), Some(id3));
        
        item1.merge(&item2);
        
        assert_eq!(item1.content, "ab");
        assert_eq!(item1.right, Some(id3));
    }
}
