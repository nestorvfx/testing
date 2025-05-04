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

  // Modified addCapture function to ensure state is properly updated
  const addCapture = useCallback((newCapture, replacementCaptures = null) => {
    if (replacementCaptures) {
      console.log(`Updating ${replacementCaptures.length} captures`);
      setCaptures(replacementCaptures);
    } else if (newCapture) {
      console.log(`Adding capture to stack: ${newCapture?.uri?.substring(0, 20)}...`);
      setCaptures(prev => [...prev, newCapture]);
    }
  }, []);
  
  // Toggle card group function needs to be more robust
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
    if (index < 0 || index >= captures.length) {
      console.warn(`Invalid index ${index} for captures array of length ${captures.length}`);
      return;
    }
    
    console.log(`Ensuring capture at index ${index} exists, current length: ${captures.length}`);
    
    // If we're not in expanded mode, expand the card group first
    if (!isCardsExpanded) {
      console.log('Cards not expanded yet, expanding card group first');
      setIsCardsExpanded(true);
      
      // Wait for card group animation to complete before expanding card
      setTimeout(() => {
        console.log(`Now expanding card at index ${index}`);
        setExpandedCardIndex(index);
        
        // Start expansion animation
        Animated.timing(cardAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }, 300);
    } else {
      // If already expanded, just expand the specific card
      console.log(`Directly expanding card at index ${index}`);
      setExpandedCardIndex(index);
      
      // Start expansion animation
      Animated.timing(cardAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [captures, isCardsExpanded, cardAnimation]);
  
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
