import { useState, useRef, useEffect, useCallback } from 'react';
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
  
  // Add a helper function to check captures array consistency
  const ensureCaptures = useCallback((index) => {
    console.log(`Ensuring capture at index ${index} exists, current length: ${captures.length}`);
    if (index >= 0 && index < captures.length) {
      return true;
    }
    console.warn(`Invalid index ${index} for captures array of length ${captures.length}`);
    return false;
  }, [captures]);

  // Split into two clear, focused functions instead of one overloaded function
  const addCapture = useCallback((newCapture) => {
    if (!newCapture) return;
    setCaptures(prev => [...prev, newCapture]);
  }, []);
  
  const updateCaptures = useCallback((capturesArray) => {
    if (!capturesArray) return;
    setCaptures(capturesArray);
  }, []);
  
  // Define collapseCard BEFORE it's used in toggleCardGroup
  const collapseCard = useCallback(() => {
    console.log("Collapsing card");
    setExpandedCardIndex(null);
  }, []);
  
  // Now toggleCardGroup can safely reference collapseCard
  const toggleCardGroup = useCallback(() => {
    console.log(`Toggling card group - current state: ${isCardsExpanded}`);
    
    if (isCardsExpanded) {
      // First collapse any expanded card
      if (expandedCardIndex !== null) {
        console.log('Collapsing expanded card first');
        collapseCard();
        
        // Wait for card collapse animation before collapsing group
        setTimeout(() => {
          console.log('Now collapsing card group');
          setIsCardsExpanded(false);
        }, 200);
      } else {
        // No expanded card, just collapse the group
        console.log('Collapsing card group directly');
        setIsCardsExpanded(false);
      }
    } else {
      // Expanding the card group
      console.log('Setting isCardsExpanded to: true');
      setIsCardsExpanded(true);
    }
  }, [isCardsExpanded, expandedCardIndex, collapseCard]);
  
  // Enhanced expandCard function
  const expandCard = useCallback((index) => {
    console.log(`Expanding card at index ${index} of ${captures.length}`);
    
    // Safety check for index bounds
    if (index < 0 || index > captures.length) {
      console.warn(`Invalid index ${index} for captures array of length ${captures.length}`);
      return;
    }
    setExpandedCardIndex(index);
    
    // Start expansion animation
    Animated.timing(cardAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [captures, cardAnimation]);
  
  // Simple outside click handler
  const handleOutsideClick = useCallback((event) => {
    if (expandedCardIndex !== null) {
      collapseCard();
    }
  }, [expandedCardIndex, collapseCard]);
  
  // Scroll function
  const scrollCards = useCallback((direction) => {
    if (scrollViewRef.current) {
      const offset = direction === 'next' ? 120 : -120;
      scrollViewRef.current.scrollTo({
        x: offset,
        animated: true
      });
    }
  }, []);
  
  // Remove the PanResponder entirely - it's interfering with ScrollView touch handling
  const panResponder = null;
  
  // Simple styles
  const cardGroupStyles = {};
  
  // Empty animation array
  const expandAnimation = [];
  
  return {
    captures,
    addCapture,
    updateCaptures, // Export the new function
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
