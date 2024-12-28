Sure, here's a Python code for creating an interactive Google Dino Run game using the Pygame library:

```python
import pygame
import random

# Initialize Pygame
pygame.init()

# Set up the game window
WINDOW_WIDTH = 800
WINDOW_HEIGHT = 400
window = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
pygame.display.set_caption("Dino Run")

# Load game assets
dino_image = pygame.image.load("dino.png")
cactus_image = pygame.image.load("cactus.png")
ground_image = pygame.image.load("ground.png")

# Game variables
dino_x = 50
dino_y = WINDOW_HEIGHT - dino_image.get_height() - 100
dino_velocity = 0
gravity = 0.6
cactus_x = WINDOW_WIDTH
cactus_y = WINDOW_HEIGHT - cactus_image.get_height() - 100
cactus_velocity = 5
score = 0

# Game loop
running = True
while running:
    # Handle events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_SPACE:
                dino_velocity = -10

    # Move the dino
    dino_velocity += gravity
    dino_y += dino_velocity

    # Move the cactus
    cactus_x -= cactus_velocity

    # Check for collision
    if dino_y >= WINDOW_HEIGHT - dino_image.get_height() - 100:
        dino_y = WINDOW_HEIGHT - dino_image.get_height() - 100
        dino_velocity = 0
    if cactus_x <= dino_x + dino_image.get_width():
        if dino_y + dino_image.get_height() >= cactus_y:
            running = False

    # Reset the cactus position
    if cactus_x <= -cactus_image.get_width():
        cactus_x = WINDOW_WIDTH
        cactus_y = WINDOW_HEIGHT - cactus_image.get_height() - random.randint(50, 150)
        score += 1

    # Clear the window
    window.fill((255, 255, 255))

    # Draw the game objects
    window.blit(ground_image, (0, WINDOW_HEIGHT - ground_image.get_height()))
    window.blit(dino_image, (dino_x, dino_y))
    window.blit(cactus_image, (cactus_x, cactus_y))

    # Draw the score
    font = pygame.font.Font(None, 36)
    score_text = font.render(f"Score: {score}", True, (0, 0, 0))
    window.blit(score_text, (10, 10))

    # Update the display
    pygame.display.update()

# Quit Pygame
pygame.quit()
```

This code creates a simple Dino Run game where the player controls the dino by pressing the space bar to jump over the incoming cactus obstacles. The game keeps track of the score, and the game ends when the dino collides with a cactus.

To run this code, you'll need to have the Pygame library installed and the `dino.png`, `cactus.png`, and `ground.png` image files in the same directory as the Python script.

Here's an example usage:

1. Install the Pygame library by running `pip install pygame` in your terminal or command prompt.
2. Save the Python code above in a file, e.g., `dino_run.py`.
3. Create a new folder and save the `dino.png`, `cactus.png`, and `ground.png` image files in that folder.
4. Open a terminal or command prompt, navigate to the folder containing the Python script and image files.
5. Run the script by typing `python dino_run.py`.

The game window should open, and you can control the dino