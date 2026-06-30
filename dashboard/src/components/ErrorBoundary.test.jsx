import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function ThrowingComponent() {
    throw new Error('Test explosion');
}

function GoodComponent() {
    return <div>All good</div>;
}

describe('ErrorBoundary', () => {
    it('renders children when no error occurs', () => {
        render(
            <ErrorBoundary>
                <GoodComponent />
            </ErrorBoundary>
        );
        expect(screen.getByText('All good')).toBeInTheDocument();
    });

    it('renders fallback UI when a child component throws', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('Test explosion')).toBeInTheDocument();
        expect(screen.getByText('Try again')).toBeInTheDocument();
        expect(screen.getByText('Reload app')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('recovers when "Try again" is clicked', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        let shouldThrow = true;

        function ConditionalThrow() {
            if (shouldThrow) throw new Error('Conditional error');
            return <div>Recovered</div>;
        }

        render(
            <ErrorBoundary>
                <ConditionalThrow />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();

        // Stop throwing and click "Try again"
        shouldThrow = false;
        fireEvent.click(screen.getByText('Try again'));

        expect(screen.getByText('Recovered')).toBeInTheDocument();
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();

        consoleSpy.mockRestore();
    });
});
