def divide_numbers(a, b):
    """
    Divide two numbers and return the result.
    Args:
        a (int or float): The dividend.
        b (int or float): The divisor.
    Returns:
        float: The result of the division.
    Raises:
        TypeError: If either a or b is not a number (int or float).
        ZeroDivisionError: If b is zero.
    """
    # Type checking
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        raise TypeError("Both arguments must be numbers (int or float).")
    
    # Division by zero check
    if b == 0:
        raise ZeroDivisionError("Cannot divide by zero.")
    
    return float(a) / float(b)
