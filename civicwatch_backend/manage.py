#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "civicwatch_backend.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    
    # Use port 9000 when running the development server if no port is specified
    if len(sys.argv) > 1 and sys.argv[1] == 'runserver':
        port_specified = False
        for arg in sys.argv[2:]:  # Check arguments after 'runserver'
            if ':' in arg and arg.split(':')[1].isdigit():  # Check for host:port format
                port_specified = True
                break
            elif arg.isdigit():  # Check for just the port
                port_specified = True
                break
        if not port_specified:
            sys.argv.append('9000')
        
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
