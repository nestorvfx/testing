import React from 'react';
import { View, Image, TouchableOpacity, Text } from 'react-native';
import { styles } from '../../styles';

const CardStack = ({ captures, toggleCardGroup }) => {
  if (!captures || captures.length === 0) return null;
  
  // Simplified card stack - no animations
  return (
    <View style={{
      width: 180,
      height: 110,
      position: 'relative',
    }}>
      {/* Photo count badge */}
      <View style={{
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#f44336',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        borderWidth: 1.5,
        borderColor: 'white',
      }}>
        <Text style={{
          color: 'white',
          fontSize: 12,
          fontWeight: 'bold',
        }}>
          {captures.length}
        </Text>
      </View>
      
      {/* Render most recent 3 captures in stack formation */}
      {captures.slice(0, 3).map((capture, index) => {
        // Position from right to left (newest on top)
        const stack = captures.length;
        const staggered = index * 10; // Amount of offset for each card
        
        return (
          <View 
            key={index} 
            style={{
              position: 'absolute',
              width: 100,
              height: 100,
              right: staggered,
              top: index * 2,
              zIndex: stack - index,
              borderRadius: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: index + 1,
            }}
          >
            <TouchableOpacity 
              onPress={toggleCardGroup}
              activeOpacity={0.85}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <Image 
                source={{ uri: capture.uri }} 
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: 'white',
                }}
              />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

export default CardStack;
