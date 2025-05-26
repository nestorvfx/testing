import { useState, useRef, useCallback } from 'react';
import { Animated } from 'react-native';

export const useCardStack = (dimensions) => {
  // State
  const [isCardsExpanded, setIsCardsExpanded] = useState(false);
  const [expandedCardIndex, setExpandedCardIndex] = useState(null);
  const [captures, setCaptures] = useState([]);
  
  // Refs
  const scrollViewRef = useRef(null);
  const cardAnimation = useRef(new Animated.Value(0)).current;
  const cardGroupBackgroundOpacity = useRef(new Animated.Value(0)).current;
  
  // Add and update functions
  const addCapture = useCallback((newCapture) => {
    if (!newCapture) return;
    setCaptures(prev => [...prev, newCapture]);
  }, []);
  
  const updateCaptures = useCallback((capturesArray) => {
    if (!capturesArray) return;
    setCaptures(capturesArray);
  }, []);
  
  // Card management functions
  const collapseCard = useCallback(() => {
    setExpandedCardIndex(null);
  }, []);
  
  const toggleCardGroup = useCallback(() => {
    if (isCardsExpanded) {
      if (expandedCardIndex !== null) {
        collapseCard();
        setTimeout(() => {
          setIsCardsExpanded(false);
        }, 200);
      } else {
        setIsCardsExpanded(false);
      }
    } else {
      setIsCardsExpanded(true);
    }
  }, [isCardsExpanded, expandedCardIndex, collapseCard]);
  
  const expandCard = useCallback((index) => {
    if (index < 0 || index > captures.length) {
      return;
    }
    setExpandedCardIndex(index);
    
    Animated.timing(cardAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [captures, cardAnimation]);
  
  const handleOutsideClick = useCallback((event) => {
    if (expandedCardIndex !== null) {
      collapseCard();
    }
  }, [expandedCardIndex, collapseCard]);
  
  const scrollCards = useCallback((direction) => {
    if (scrollViewRef.current) {
      const offset = direction === 'next' ? 120 : -120;
      scrollViewRef.current.scrollTo({
        x: offset,
        animated: true
      });
    }
  }, []);
  
  // Removed PanResponder, simplified styles
  const panResponder = null;
  const cardGroupStyles = {};
  const expandAnimation = [];
  
  return {
    captures,
    addCapture,
    updateCaptures,
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
