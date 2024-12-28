def print_fibonacci_pyramid(n):
    """
    Generate a Fibonacci sequence up to n terms and display it as an ASCII art pyramid using asterisks (*).
    
    Args:
        n (int): The number of rows in the pyramid (must be a positive integer).
        
    Returns:
        None
        
    Raises:
        ValueError: If n is not a positive integer.
    """
    if not isinstance(n, int) or n < 1:
        raise ValueError("n must be a positive integer.")

    # Generate Fibonacci sequence
    fibonacci = [1, 1]
    for i in range(2, n):
        fibonacci.append(fibonacci[i-1] + fibonacci[i-2])
    
    # Find maximum width for centering
    max_width = len('*' * fibonacci[-1])
    
    # Print pyramid
    print('\n') # Add some spacing
    for num in fibonacci:
        stars = '*' * num
        print(f"{stars:^{max_width}}")
    print('\n') # Add some spacing

# Example usage
print_fibonacci_pyramid(10)
