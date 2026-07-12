import { Alert } from 'antd';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface EntityPreviewBoundaryProps {
  children: ReactNode;
}

interface EntityPreviewBoundaryState {
  hasError: boolean;
}

export class EntityPreviewBoundary extends Component<EntityPreviewBoundaryProps, EntityPreviewBoundaryState> {
  state: EntityPreviewBoundaryState = { hasError: false };

  static getDerivedStateFromError(): EntityPreviewBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return <Alert title="预览暂不可用" type="error" />;
    }

    return this.props.children;
  }
}
