import { useState, useRef } from 'react';
import { Animated } from 'react-native';

export const useCardStack = (dimensions) => {
  // Basic state for cards functionality
  const [isCardsExpanded, setIsCardsExpanded] = useState(false);
  const [expandedCardIndex, setExpandedCardIndex] = useState(null);
  const [captures, setCaptures] = useState([]);
  
  // Simple refs
  const scrollViewRef = useRef(null);
  const cardAnimation = useRef(new Animated.Value(0)).current;
  const cardGroupBackgroundOpacity = useRef(new Animated.Value(0)).current;
  
  // Add a new capture to the stack or replace all captures with a new array
  const addCapture = (newCapture, newCaptures = null) => {
    // If newCaptures is provided, replace all captures with this array
    if (newCaptures) {
      console.log(`Updating ${newCaptures.length} captures with analysis results`);
      setCaptures(newCaptures);
      return;
    }
    
    // Otherwise add a single new capture
    if (!newCapture) return;
    
    console.log("Adding capture to stack:", newCapture.uri.substring(0, 30) + "...");
    
    // Update captures array with newest first
    setCaptures(prevCaptures => {
      return [newCapture, ...prevCaptures];
    });
  };
  
  // Simple toggle function
  const toggleCardGroup = () => {
    console.log("Toggling card group, current state:", isCardsExpanded);
    
    if (expandedCardIndex !== null) {
      collapseCard();
      return;
    }
    
    setIsCardsExpanded(!isCardsExpanded);
  };
  
  // Expand a single card
  const expandCard = (index) => {
    console.log("Expanding card at index:", index);
    
    if (index < 0 || index >= captures.length) {
      console.warn("Invalid card index:", index);
      return;
    }
    
    setExpandedCardIndex(index);
  };
  
  // Collapse expanded card
  const collapseCard = () => {
    console.log("Collapsing card");
    setExpandedCardIndex(null);
  };
  
  // Simple outside click handler
  const handleOutsideClick = (event) => {
    if (expandedCardIndex !== null) {
      collapseCard();
    }
  };
  
  // Scroll function
  const scrollCards = (direction) => {
    if (scrollViewRef.current) {
      const offset = direction === 'next' ? 120 : -120;
      scrollViewRef.current.scrollTo({
        x: offset,
        animated: true
      });
    }
  };
  
  // Remove the PanResponder entirely - it's interfering with ScrollView touch handling
  const panResponder = null;
  
  // Simple styles
  const cardGroupStyles = {};
  
  // Empty animation array
  const expandAnimation = [];
  
  return {
    captures,
    addCapture,
    isCardsExpanded,
    expandedCardIndex,
    toggleCardGroup,
    expandCard,
    collapseCard,
    handleOutsideClick,
    scrollCards,
    scrollViewRef,
    cardAnimation,
    cardGroupBackgroundOpacity,
    panResponder,
    cardGroupStyles,
    expandAnimation,
  };
};
