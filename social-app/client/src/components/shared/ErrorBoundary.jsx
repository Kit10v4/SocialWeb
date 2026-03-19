import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {}

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center max-w-sm w-full">
            <p className="text-sm font-semibold text-gray-800 mb-2">
              Có lỗi xảy ra, thử tải lại trang
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
            >
              Tải lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
