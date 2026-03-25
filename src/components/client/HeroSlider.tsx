'use client';

import { useState, useEffect } from 'react';

const IMAGES = [
  '/images/promos/hero1.jpg',
  '/images/promos/hero2.jpg',
  '/images/promos/hero3.jpg',
];

export function HeroSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % IMAGES.length);
    }, 5000); // 5 seconds per slide
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {IMAGES.map((src, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === currentIndex ? 'opacity-100' : 'opacity-0 z-[-1]'
          }`}
        >
          <img
            src={src}
            alt={`Hero Background ${index + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
      
      {/* Slider Indicators */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-3 z-20">
        {IMAGES.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full transition-colors duration-300 ${
              index === currentIndex ? 'bg-[#FF007F] scale-125 shadow-[0_0_10px_rgba(255,0,127,0.8)]' : 'bg-white/50 hover:bg-white/80'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </>
  );
}
