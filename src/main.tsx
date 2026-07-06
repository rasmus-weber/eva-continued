import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, defaultLocalizationContext } from '@economic/taco';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider
            settings={{ uniqueUserIdentifier: 'demo-user' }}
            localization={{
                ...defaultLocalizationContext,
                table: {
                    ...defaultLocalizationContext.table,
                    footer: {
                        summary: {
                            records: 'Poster:',
                            count: 'af',
                            selected: 'Poster valgt:',
                        },
                    },
                },
            }}
        >
            <App />
        </Provider>
    </StrictMode>
);
