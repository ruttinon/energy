import React, { useState, useEffect } from 'react';
import { PhotoEditorProvider } from './PhotoEditorContext';
import PhotoEditorLayout from './PhotoEditorLayout';

const PhotoViewEditor = () => {
    const [fabricLoaded, setFabricLoaded] = useState(false);

    useEffect(() => {
        if (window.fabric) {
            setFabricLoaded(true);
            return;
        }

        // Prevent double loading
        if (window.__fabricLoading) return;
        window.__fabricLoading = true;

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js';
        script.onload = () => {
            setFabricLoaded(true);
            window.__fabricLoading = false;
        };
        document.head.appendChild(script);
    }, []);

    if (!fabricLoaded) {
        return (
            <div className="h-full flex items-center justify-center text-amber-500 font-orbitron animate-pulse">
                INITIALIZING CORE ENGINE...
            </div>
        );
    }

    return (
        <PhotoEditorProvider>
            <PhotoEditorLayout />
        </PhotoEditorProvider>
    );
};

export default PhotoViewEditor;
