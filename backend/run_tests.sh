#!/bin/bash
# Test runner script for NSB Arena backend

set -e  # Exit on error

echo "===================="
echo "NSB Arena Test Suite"
echo "===================="
echo ""

# Check if running in Docker
if [ -f /.dockerenv ]; then
    echo "Running in Docker container"
    IN_DOCKER=true
else
    echo "Running locally"
    IN_DOCKER=false
fi

# Parse command line arguments
VERBOSE=""
COVERAGE=false
APP=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE="--verbosity=2"
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -a|--app)
            APP="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [-v|--verbose] [-c|--coverage] [-a|--app APP_NAME]"
            exit 1
            ;;
    esac
done

if [ "$COVERAGE" = true ]; then
    echo "Running tests with coverage..."
    coverage run --source='.' manage.py test $VERBOSE $APP
    echo ""
    echo "Coverage Report:"
    coverage report
    echo ""
    echo "Generating HTML coverage report..."
    coverage html
    echo "HTML report generated at: htmlcov/index.html"
else
    echo "Running tests..."
    python manage.py test $VERBOSE $APP
fi

echo ""
echo "===================="
echo "Tests completed!"
echo "===================="
