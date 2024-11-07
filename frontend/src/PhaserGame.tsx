import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { scenes } from './config/scenes';
import { useNavigate } from 'react-router-dom';

const PhaserGame: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Only initialize the game once when the component mounts
    if (!gameRef.current && gameContainerRef.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: window.innerWidth,
          height: window.innerHeight,
        },
        scene: scenes,
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
        render: {
          antialias: false, // Disable anti-aliasing
          pixelArt: true,   // Enable pixel art mode
        },
        parent: gameContainerRef.current, // Attach Phaser game to the div
      };

      gameRef.current = new Phaser.Game(config);

      // Load saved progress from localStorage
      const savedProgress = localStorage.getItem('playerProgress');
      if (savedProgress) {
        try {
          const progress = JSON.parse(savedProgress);
          console.log('Phaser progress:', progress);
              
          const levelName = progress.Level; // put the  level that we want to render when resume
          const sceneExists = scenes.some(
            (scene: any) => scene.name === levelName
          );

          if (sceneExists && gameRef.current) {
            gameRef.current.scene.start(levelName);
          } else {
            console.warn('Invalid level name or scene not found.');
          }
        } catch (error) {
          console.error('Error parsing player progress:', error);
        }
      }
    }

    // Cleanup function to destroy the game instance when the component unmounts
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return <div id="phaser-game" ref={gameContainerRef} />;
};

export default PhaserGame;
