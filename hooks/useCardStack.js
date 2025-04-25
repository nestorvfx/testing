import { useState, useRef, useEffect } from 'react';
import { Animated, Platform } from 'react-native';

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
  
  // Toggle function with improved logging
  const toggleCardGroup = () => {
    console.log("Toggling card group - current state:", isCardsExpanded);
    
    if (expandedCardIndex !== null) {
      collapseCard();
      return;
    }
    
    // For Android, add an explicit state update with logging
    if (Platform.OS === 'android') {
      console.log('Setting isCardsExpanded to:', !isCardsExpanded);
      setIsCardsExpanded(!isCardsExpanded);
      
      // For good measure, also reset scroll position
      if (scrollViewRef.current && !isCardsExpanded) {
        setTimeout(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ x: 0, animated: false });
          }
        }, 50);
      }
    } else {
      setIsCardsExpanded(!isCardsExpanded);
    }
  };
  
  // Expand a single card with improved Android handling
  const expandCard = (index) => {
    console.log("Expanding card at index:", index);
    
    if (index < 0 || index >= captures.length) {
      console.warn("Invalid card index:", index);
      return;
    }
    
    // For Android, use a small delay to ensure the previous state updates complete
    if (Platform.OS === 'android') {
      // First collapse any expanded card
      if (expandedCardIndex !== null) {
        setExpandedCardIndex(null);
        
        // Then expand the new card after a brief delay
        setTimeout(() => {
          setExpandedCardIndex(index);
        }, 50);
      } else {
        setExpandedCardIndex(index);
      }
    } else {
      setExpandedCardIndex(index);
    }
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
